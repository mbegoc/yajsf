import html_templates from './templates.html?raw'


export default class FieldRenderer {
  constructor(schema, root, data, options, name_prefix) {
    this.schema = schema
    this.root = root
    this.data = data || ''
    this.options = options || ''
    this.name_prefix = name_prefix || ''
  }

  // types: boolean, string, array, integer, number, object
  // formats: date-time, date, email, regex, password, uri, time, uuid4
  typeMapping = {
    "boolean": {"type": "checkbox"},
    "date-time": {"type": "datetime-local"},
    "uri": {"type": "url"},
    "array": {"widget": "select"},
    "enum": {"widget": "select"},
    "textarea": {"widget": "textarea"},
    "object": {"callback": this.render},
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

  async render() {
    for (let name in this.schema.properties) {
      const {field_schema, schemaType, attributes, widget} = this.extractData(name)

      const field_attributes = this.buildAttributes(attributes, field_schema, schemaType)

      if (widget === 'select') {
        let enum_ = this.getEnum(field_schema)
        if (enum_.type === "object") {
          // nested model
          const renderer = new FieldRenderer(enum_, this.root, this.data, this.options, `${name}.`)
          await renderer.render()
        } else {
          var field = await this.createChoiceField(widget, field_schema, field_attributes, enum_)
        }
      } else {
        var field = this.createField(widget, field_schema, field_attributes)
      }

      console.log(name, widget, schemaType)
      this.root.appendChild(field)
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

      console.log(attributes)
    for (let name in attributes) {
      field.setAttribute(name, attributes[name])
    }

    return field
  }

  async createChoiceField(widget, field_schema, attributes, options) {
    if (options.length < 5) {
      // widget = 'radio'
    }
    const field = this.createField(widget, field_schema, attributes)

    await options.forEach(option => {
      const optionElement = document.createElement('option')
      optionElement.value = option
      optionElement.text = option
      if (attributes.value === option) {
        optionElement.setAttribute('selected', 'selected')
      }
      field.addOption(optionElement)
    })

    return field
  }

  extractData(name) {
    const field_schema = this.getFieldDesc(name)
    const schemaType = this.getSchemaType(field_schema)
    const {widget = "input", callback, ...attributes} = this.typeMapping[schemaType] || {"type": schemaType}
    attributes['name'] = this.name_prefix + name
    console.log({
      widget: widget,
      schemaType: schemaType,
      field_schema: field_schema,
      attributes: attributes,
    })
    return {
      widget: widget,
      schemaType: schemaType,
      field_schema: field_schema,
      attributes: attributes,
    }
  }

  buildAttributes(attributes, field_schema, schemaType) {
    let titlePrefix = ''
    if (this.schema.required.indexOf(attributes.name) > -1) {
      attributes["required"] = "required"
      titlePrefix = '* '
    }
    if (schemaType === "array") {
      attributes['multiple'] = "multiple"
    }
    attributes['value'] = this.data![attributes.name] || field_schema.default || ''
    if (attributes.type === "checkbox" && (this.data[attributes.name] || field_schema.default)) {
      attributes["checked"] = "checked"
    }
    for (let attrName in this.attrMapping) {
      if (typeof(field_schema[attrName]) !== "undefined") {
        attributes[this.attrMapping[attrName]] = field_schema[attrName]
      }
    }
    const customAttrs = (this.options[attributes.name] || {attrs: {}})["attrs"]
    return Object.assign(attributes, customAttrs)
  }

  getFieldDesc(name) {
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
    return anyOf.reduce((r, i) => i["format"] && i["type"] ? i : r)
  }

  getRef(name) {
    return this._getRef(name.split("/"))

  }

  _getRef(path, node) {
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
