// @ts-nocheck
import { SchemaHelper } from "./utils/schema"
import { mergeObjects } from "./utils/helpers"
import { settings } from "./config"


class FieldBuilder {

    // types: boolean, string, array, integer, number, object
    // formats: date-time, date, email, regex, password, uri, time, uuid4
    protected typeMapping = {
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

    protected attrMapping = {
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

    constructor(name, data, required, customization, prefix="") {
        this.name = name
        this.data = data
        this.required = required
        // this.customization = {...this.typeMapping[this.format], ...customization}
        this.customization = mergeObjects(
            this.typeMapping[this.format], customization)
        this.prefix = prefix
        this.titlePrefix = ""  // configurable?
    }

    get widget() {
        if (! this._widget) {
            this._widget = this.customization["widget"] || "input"
        }

        return this._widget
    }

    get format() {
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

    get attributes() {
        if (! this._attributes) {
            this._attributes = {"name": this.name}
            if (this.widget === "input") {
                this._attributes["type"] = this.customization["type"] || "text"
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
            return mergeObjects(this._attributes, this.customization["attrs"])
        }

        return this._attributes
    }

    build() {
        let field
        if (this.attributes["type"] === "number"
                && (this.attributes["max"] - this.attributes["min"]) < 50) {
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
            field = new FieldClass()
            field.appendChild(document.createTextNode(
                `${this.titlePrefix} ${this.data.title}`))
            field.setAttributes(this.attributes)
        }

        // needed for including the field into the generated formData
        field.setAttribute("name", this.attributes.name)

        // select doesn't support passing options through slots, we need to
        // programatically add them
        if (this.choices) {
            if (this.choices.length < 5) {
                // widget = 'radio'
            }
            for (let choice of this.choices) {
                let optionElement = document.createElement('option')
                optionElement.value = optionElement.text = choice
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

    constructor(schema, root, data={}, options={}, namePrefix='') {
        this.schema = schema
        this.root = root
        this.schemaHelper = new SchemaHelper(this.schema)
        this.data = data
        this.options = options
        this.namePrefix = namePrefix
    }

    build() {
        for (let [name, data, inRequired] of this.schemaHelper.properties()) {
            let fieldBuilder = new FieldBuilder(
                name,
                data,
                inRequired,
                this.options[name],
                this.namePrefix,
            )

            if (fieldBuilder.widget === 'select') {
                let enum_ = this.schemaHelper.getEnum(data)
                if (enum_.type === "object") {
                    // if a nested model, we don't add options but rather
                    // build a subform
                    let builder = new FormBuilder(
                        enum_, this.root, this.data, this.options, `${name}__`)
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
