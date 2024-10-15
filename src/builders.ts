import type {
    Dict,
    Literal,
    HTMLFieldAttributes,
    Schema,
    Property,
    FieldOptions,
    FieldOption,
    Enum,
} from "./types"
import { SchemaHelper } from "./utils/schema"
import { settings } from "./config"
import { getLogger } from "./utils/logging"
import { deepMerge } from "./utils/helpers"
import { YAJSFForm, YAJSFField, YAJSFSelect, YAJSFError } from "./components"


const logger = getLogger("Builders", "Orchid")


class FieldBuilder {

    // schema types: boolean, string, array, integer, number, object
    // schema formats, almost a mapping with input types:
    // date-time, date, email, regex, password, uri, time, uuid4
    protected typeMapping: FieldOptions = {
        "boolean": {"attrs": {"type": "checkbox"}},
        "date-time": {"attrs": {"type": "datetime-local"}},
        "uri": {"attrs": {"type": "url"}},
        "integer": {"attrs": {"type": "number"}},

        // alternative field types
        "array": {"widget": "select"},
        "enum": {"widget": "select"},
        "undefined": {"widget": settings.defaultWidget},

        // we could use the format as the type, but we would need
        // to filter the unsupported formats. It's simpler to just
        // add a mapping for these values and let the default "text"
        // for not matching format
        "date": {"attrs": {"type": "date"}},
        "time": {"attrs": {"type": "time"}},
        "email": {"attrs": {"type": "email"}},
        "number": {
            "attrs": {"type": "number", "step": settings.defaultNumberStep},
        },
        "password": {"attrs": {"type": "password"}},
    }

    protected attrMapping: Dict<keyof HTMLFieldAttributes> = {
        "minLength": "minlength",
        "maxLength": "maxlength",
        "maximum": "max",
        "minimum": "min",
        "exclusiveMinimum": "min", // +1
        "exclusiveMaximum": "max", // -1
        // "pattern": "pattern",
        // readonly
        // step
    }

    protected name: string
    protected property: Property
    protected required: boolean
    protected customization: FieldOption
    public choices?: Enum
    protected namePrefix: string
    protected titlePrefix: string

    protected _widget?: string
    protected _format?: string
    protected _attributes?: HTMLFieldAttributes

    constructor(name: string, property: Property, required: boolean,
                customization: FieldOption, namePrefix="", titlePrefix="") {
        this.name = name
        this.property = property
        this.required = required
        this.customization = deepMerge(this.typeMapping[this.format],
                                       customization)
        this.namePrefix = namePrefix
        this.titlePrefix = titlePrefix
    }

    get widget(): string {
        if (! this._widget) {
            this._widget = this.customization.widget || "input"
        }

        return this._widget
    }

    get format(): string {
        if (! this._format) {
            if (this.property.enum) {
                return "enum"
            } else if (this.property.format) {
                return this.property.format
            } else if (this.property.type) {
                return this.property.type
            } else {
                return "undefined"
            }
        }

        return this._format
    }

    get attributes(): HTMLFieldAttributes {
        if (! this._attributes) {
            this._attributes = {"name": `${this.namePrefix}${this.name}`}
            if (this.widget === "input") {
                this._attributes["type"] = this.customization.attrs?.type || "text"
            }

            // is the field required?
            if (this.required) {
                this._attributes["required"] = "required"
            }

            let title = []
            if (this.required) {
                title.push(settings.requiredTitlePrefix)
            }
            if (settings.titlePrefix) {
                title.push(settings.titlePrefix)
                title.push(settings.titleSeparator)
            }
            if (this.titlePrefix) {
                title.push(this.titlePrefix)
                title.push(settings.titleSeparator)
            }
            if (this.customization["title"]) {
                title.push(this.customization["title"])
            } else {
                title.push(this.property.title)
            }
            this._attributes["title"] = title.join(" ")

            // if the field is a list, allow to add multiple options
            // @TODO: handle multiple subforms
            if (this.format === "array") {
                this._attributes['multiple'] = "multiple"
            }

            // set the initial value of the field: property, default, empty
            if (! this._attributes.value && this.property.default) {
                this._attributes['value'] = this.property.default
            }
            // check the checkboxes
            if (this._attributes.type === "checkbox"
                    && (this._attributes.value || this.property.default)) {
                this._attributes["checked"] = "checked"
            }
            // transfer schema attributes to HTML one
            for (let [fromAttr, toAttr] of Object.entries(this.attrMapping)) {
                if (typeof(this.property[fromAttr as keyof Property]) !== "undefined") {
                    this._attributes[toAttr] = this.property[fromAttr as keyof Property]
                }
            }
            this._attributes = {...this._attributes,
                                ...this.customization["attrs"]}
        }

        return this._attributes
    }

    build(): YAJSFField {
        if (this.attributes["type"] === "number"
                && (this.attributes["max"] as any - (this.attributes["min"] as any)) < 50) {
            this.attributes["type"] = "range"
        }
        
        let FieldClass = customElements.get(`y-${this.widget}`)
        if (! FieldClass) {
            throw new YAJSFError("Field type is not a registered custom element")
        }
        let field = new FieldClass() as YAJSFField
        field.setAttributes(this.attributes)

        // select doesn't support passing options through slots, we need to
        // programatically add them
        if (this.choices && field.constructor === YAJSFSelect) {
            if (this.choices.length < 5) {
                // widget = 'radio'
            }
            for (let choice of this.choices as string[]) {
                let optionElement = document.createElement('option')
                optionElement.value = optionElement.label = choice
                if (this.attributes.value === choice) {
                    optionElement.setAttribute('selected', 'selected')
                }
                field.addOption(optionElement)
            }
        }

        return field
    }

}


export class FormBuilder {
    protected schema: Schema
    protected schemaHelper: SchemaHelper
    protected root: YAJSFForm
    protected data: Dict<Literal>
    protected options: FieldOptions
    protected namePrefix: string
    protected titlePrefix: string

    constructor(schema: Schema, root: YAJSFForm, data: Dict<Literal> = {},
                options: FieldOptions = {}, namePrefix="", titlePrefix="") {
        this.schema = schema
        this.root = root
        this.schemaHelper = new SchemaHelper(this.schema)
        this.data = data
        this.options = options
        this.namePrefix = namePrefix
        this.titlePrefix = titlePrefix
    }

    build() {
        for (let [name, property, inRequired] of this.schemaHelper.properties()) {
            let options = Object.assign({}, this.options[name])
            if (Object.keys(this.data).includes(name)) {
                options.attrs = {value: this.data[name], ...options.attrs}
            }
            let fieldBuilder = new FieldBuilder(
                name,
                property,
                inRequired,
                options,
                this.namePrefix,
                this.titlePrefix,
            )

            if (fieldBuilder.widget === 'select') {
                let subSchema = this.schemaHelper.getSubSchema(property)
                if (subSchema) {
                    // if a nested model, we don't add options but rather
                    // build a subform
                    let builder = new FormBuilder(
                        subSchema,
                        this.root,
                        this.data,
                        this.options,
                        `${name}/`,
                        property.title,
                    )
                    builder.build()
                    continue
                } else {
                    fieldBuilder.choices = this.schemaHelper.getEnum(property)
                }
            }

            let field = fieldBuilder.build()

            this.root.addField(field)
        }
    }

}
