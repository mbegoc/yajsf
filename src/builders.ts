import type {
    Schema,
    PropertyType,
    Property,
    FieldOptions,
    FieldOption,
    Enum,
} from "./types"
import { SchemaHelper } from "./utils/schema"
import { settings } from "./config"
import { YAJSFForm, YAJSFField, YAJSFSelect, YAJSFError } from "./components"


class FieldBuilder {

    // types: boolean, string, array, integer, number, object
    // formats: date-time, date, email, regex, password, uri, time, uuid4
    protected typeMapping: FieldOptions = {
        "boolean": {"type": "checkbox"},
        "date-time": {"type": "datetime-local"},
        "uri": {"type": "url"},
        "integer": {"type": "number"},

        // we could use the format as the type, but we would need
        // to filter the unsupported formats. It's simpler to just
        // add a mapping for these values and let the default "text"
        // for not matching format
        "date": {"type": "date"},
        "time": {"type": "time"},
        "email": {"type": "email"},
        "number": {
            "type": "number",
            "attrs": {"step": settings.defaultNumberStep},
        },
        "password": {"type": "password"},

        "array": {"widget": "select"},
        "enum": {"widget": "select"},
        "undefined": {"widget": settings.defaultWidget},
        // search
        // month
        // image
        // tel
        // color
        // week
        // file

        // radio
        // hidden
    }

    protected attrMapping: {[key: string]: string} = {
        "minLength": "minlength",
        "maxLength": "maxlength",
        "maximum": "max",
        "minimum": "min",
        "exclusiveMinimum": "min", // +1
        "exclusiveMaximum": "max", // -1
        // pattern
        // readonly
        // step
    }

    protected name: string
    protected data: Property
    protected required: Boolean
    protected customization
    public choices?: PropertyType | Enum
    protected titlePrefix: string
    protected namePrefix: string

    protected _widget?: string
    protected _format?: string
    protected _attributes?: {[key: string]: string}

    constructor(name: string, data: Property, required: Boolean,
                customization: FieldOption, namePrefix="") {
        this.name = name
        this.data = data
        this.required = required
        this.customization = {...this.typeMapping[this.format],
                              ...customization}
        this.namePrefix = namePrefix
        this.titlePrefix = ""  // configurable?
    }

    get widget(): string {
        if (! this._widget) {
            this._widget = this.customization?.widget || "input"
        }

        return this._widget
    }

    get format(): string {
        if (! this._format) {
            if (this.data.enum) {
                return "enum"
            } else if (this.data.format) {
                return this.data.format
            } else if (this.data.type) {
                return this.data.type
            } else {
                return "undefined"
            }
        }

        return this._format
    }

    get attributes(): {[key: string]: string} {
        if (! this._attributes) {
            this._attributes = {"name": `${this.namePrefix}${this.name}`}
            if (this.widget === "input") {
                this._attributes["type"] = this.customization?.type || "text"
            }

            // is the field required?
            if (this.required) {
                this._attributes["required"] = "required"
            }

            // if the field is a list, allow to add multiple options
            // @TODO: handle multiple subforms
            if (this.format === "array") {
                this._attributes['multiple'] = "multiple"
            }

            // set the initial value of the field: data, default, empty
            this._attributes['value'] = this.data[this.name] || this.data.default || ''
            // check the checkboxes
            if (this._attributes.type === "checkbox"
                && (this.data[this._attributes.name] || this.data.default)) {
                this._attributes["checked"] = "checked"
            }
            // transfer schema attributes to HTML one
            for (let [fromAttr, toAttr] of Object.entries(this.attrMapping)) {
                if (typeof(this.data[fromAttr]) !== "undefined") {
                    this._attributes[toAttr] = this.data[fromAttr]
                }
            }
            return {...this._attributes, ...this.customization["attrs"]}
        }

        return this._attributes
    }

    build(): YAJSFField | HTMLInputElement {
        let field
        if (this.attributes["type"] === "number"
                && (this.attributes["max"] as any - (this.attributes["min"] as any)) < 50) {
            this.attributes["type"] = "range"
        }

        if (this.attributes['required']) {
            this.titlePrefix = "* "
        }
        
        if (this.widget === "hidden" || this.attributes.type === "hidden") {
            this.attributes.type = "hidden"
            field = document.createElement("input")
        } else {
            let FieldClass = customElements.get(`y-${this.widget}`)
            if (! FieldClass) {
                throw new YAJSFError("Field type is not a registered custom element")
            }
            field = new FieldClass() as YAJSFField
            field.appendChild(document.createTextNode(
                `${this.titlePrefix} ${this.data.title}`))
            field.setAttributes(this.attributes)
        }

        // needed for including the field into the generated formData
        field.setAttribute("name", this.attributes.name)

        // select doesn't support passing options through slots, we need to
        // programatically add them
        if (this.choices && field.constructor === YAJSFSelect) {
            if (this.choices.length < 5) {
                // widget = 'radio'
            }
            for (let choice of this.choices as string[]) {
                let optionElement = document.createElement('option')
                optionElement.value = optionElement.text = choice as string
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
    protected root: YAJSFForm // circular import?
    protected data: {}
    protected options: FieldOptions
    protected namePrefix: string

    constructor(schema: Schema, root: YAJSFForm, data={}, options={}, namePrefix='') {
        this.schema = schema
        this.root = root
        this.schemaHelper = new SchemaHelper(this.schema)
        this.data = data
        this.options = options
        this.namePrefix = namePrefix
    }

    build(): void {
        for (let [name, property, inRequired] of this.schemaHelper.properties()) {
            let fieldBuilder = new FieldBuilder(
                name,
                property,
                inRequired,
                this.options[name],
                this.namePrefix,
            )

            if (fieldBuilder.widget === 'select') {
                let enum_ = this.schemaHelper.getEnum(property)
                if ((enum_ as Schema).type === "object") {
                    // if a nested model, we don't add options but rather
                    // build a subform
                    let builder = new FormBuilder(
                        enum_ as Schema, this.root, this.data, this.options, `${name}__`)
                    builder.build()
                } else {
                    fieldBuilder.choices = enum_
                }
            }

            let field = fieldBuilder.build()

            this.root.addField(field)
        }
    }

}
