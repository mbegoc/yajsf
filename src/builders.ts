// @ts-nocheck
import html_templates from './templates.html?raw'


export default class FormBuilder {

  // types: boolean, string, array, integer, number, object
  // formats: date-time, date, email, regex, password, uri, time, uuid4
  typeMapping = {
    "boolean": {"type": "checkbox"},
    "date-time": {"type": "datetime-local"},
    "uri": {"type": "url"},
    "array": {"widget": "select"},
    "enum": {"widget": "select"},
    "textarea": {"widget": "textarea"},
  }

  attrMapping = {
    "minLength": "minlength",
    "maxLength": "maxlength",
    "maximum": "max",
    "minimum": "min",
    "exclusiveMinimum": "min", // +1
    "exclusiveMaximum": "max", // -1
    // pattern
    // readonly
    // step
    // novalidate?
  }

  constructor(schema, root, data={}, options={}, name_prefix='') {
    this.schema = schema
    this.root = root
    this.data = data
    this.options = options
    this.name_prefix = name_prefix
  }

  build() {
    for (let name in this.schema.properties) {
      const {field_schema, schemaType, attributes, widget} = this.extractFieldData(name)

      const field_attributes = this.buildAttributes(attributes, field_schema, schemaType)

      // select doesn't support passing options through slots, we need to
      // programatically add them
      if (widget === 'select') {
        let enum_ = this.getEnum(field_schema)
        if (enum_.type === "object") {
          // if a nested model, we don't add options but rather build a subform
          const builder = new FormBuilder(enum_, this.root, this.data, this.options, `${name}.`)
          builder.build()
        } else {
          var field = this.createChoiceField(
            widget, field_schema, field_attributes, enum_)
        }
      } else {
        var field = this.createField(widget, field_schema, field_attributes)
      }

      this.root.addField(field)
    }
    return this
  }

  createField(widget, field_schema, attributes) {
    widget = (this.options[attributes.name] || {})["widget"] || widget
    if (attributes["type"] === "integer" && (attributes["max"] - attributes["min"]) < 50) {
      attributes["type"] = "range"
    }

    const field = new (customElements.get(`yajsf-${widget}`))()
    const titlePrefix = attributes['required'] ? "* " : ""
    field.appendChild(document.createTextNode(titlePrefix + field_schema.title))

    for (let name in attributes) {
      field.setAttribute(name, attributes[name])
    }

    return field
  }

  createChoiceField(widget, field_schema, attributes, options) {
    if (options.length < 5) {
      // widget = 'radio'
    }
    const field = this.createField(widget, field_schema, attributes)

    options.forEach(option => {
      const optionElement = document.createElement('option')
      optionElement.value = optionElement.text = option
      if (attributes.value === option) {
        optionElement.setAttribute('selected', 'selected')
      }
      field.addOption(optionElement)
    })

    return field
  }

  extractFieldData(name) {
    const field_schema = this.getFieldSchema(name)
    const schemaType = this.getSchemaType(field_schema)
    const {widget = "input", callback, ...attributes} = this.typeMapping[schemaType] || {"type": schemaType}
    attributes['name'] = this.name_prefix + name

    return {
      widget: widget,
      schemaType: schemaType,
      field_schema: field_schema,
      attributes: attributes,
    }
  }

  buildAttributes(attributes, field_schema, schemaType) {
    // is the field required?
    if (this.schema.required.indexOf(attributes.name) > -1) {
      attributes["required"] = "required"
    }
    // if the field is a list, allow to add multiple options
    if (schemaType === "array") {
      attributes['multiple'] = "multiple"
    }
    // set the initial value of the field: data, default, empty
    attributes['value'] = this.data[attributes.name] || field_schema.default || ''
    // check the checkboxes
    if (attributes.type === "checkbox"
          && (this.data[attributes.name] || field_schema.default)) {
      attributes["checked"] = "checked"
    }
    // transfer schema attributes to HTML one
    for (let attrName in this.attrMapping) {
      if (typeof(field_schema[attrName]) !== "undefined") {
        attributes[this.attrMapping[attrName]] = field_schema[attrName]
      }
    }
    const customAttrs = (this.options[attributes.name] || {attrs: {}})["attrs"]
    return Object.assign(attributes, customAttrs)
  }

  getFieldSchema(name) {
    let {$ref, anyOf, ...field_schema} = this.schema.properties[name]

    if ($ref) {
      field_schema = this.getRef($ref)
    }

    if (anyOf) {
      field_schema = Object.assign(field_schema, this.reduceAnyOf(anyOf))
    }

    return field_schema
  }

  getSchemaType(field_schema) {
    if (field_schema.enum) {
      return "enum"
    } else if (field_schema.format) {
      return field_schema.format
    } else if (field_schema.type) {
      return field_schema.type
    } else {
      // if absolutely nothing is found, the type is Any. It can be json, text,
      // numbers, array. Textarea is the best for managing complex data
      return "textarea"
    }
  }

  getEnum(desc) {
    const {enum: enum_, items, $ref} = desc
    if (enum_ || items) {
      return this.getEnum(enum_ || items)
    } else if ($ref) {
      return this.getEnum(this.getRef($ref))
    }
    return desc
  }

  reduceAnyOf(anyOf) {
    // @KLUDGE: not sure for this behavior, how to determine the right type
    // and validation to apply on the field?
    return anyOf.reduce((r, i) => i["format"] && i["type"] ? i : r)
  }

  getRef(name) {
    return this._getRef(name.split("/"))

  }

  protected _getRef(path, node) {
    let name = path.shift()
    if (name === "#" && ! node) {
      node = this.schema
      name = path.shift()
    }
    if (path.length !== 0) {
      return this._getRef(path, node[name])
    } else {
      return node[name]
    }
  }
}
