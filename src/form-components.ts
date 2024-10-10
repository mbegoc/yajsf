// @ts-nocheck
import * as globalConfig from './yajsf-config.json'
import html_templates from './templates.html?raw'
import FormBuilder from './builders'


export let ready = null


export class BaseYAJSFElement extends HTMLElement {
  static formAssociated = true
  mainNode = null

  constructor(template) {
    super()

    this.attachShadow({ mode: "open" })
    this.shadowRoot.appendChild(template.content.cloneNode(true))
    this.internals_ = this.attachInternals()
    this.mainNode = this.shadowRoot.querySelector('#main')
  }
  
  async connectedCallback() {
    console.log('waiting...', ready)
    await ready
    console.log('Ready!', ready)
    for (let attribute of this.attributes) {
      this.mainNode.setAttribute(attribute.name, attribute.value)
    }

    if (this.internals_.form) {
      this.internals_.form.addEventListener('submit', e => this.internals_.setFormValue(this.mainNode.value), {capture: true})
    }

    this.injectTemplateScripts()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.info('#####', name, oldValue, newValue)

  }

  disconnectedCallback() {
    console.info("########### DISCONNECTED ############")
  }

  adoptedCallback() {
    console.info("########### ADOPTED ############")
  }

  injectTemplateScripts() {
    /**
     * Inject component scripts
     */
    // see if it may be necessary to have embeded scripts. Should at least
    // be optional.
    if (globalConfig.injectScripts) {
      this.shadowRoot.querySelectorAll('script').forEach(script_node => {
        let newScript = document.createElement('script')
        newScript.innerText = script_node.innerText
        this.shadowRoot.replaceChild(newScript, script_node)
      })
    }
  }

  addError(msg) {
    let errors = this.shadowRoot.querySelector(".errors")
    if (errors) {
      let ul = errors.querySelector("ul")
      if (! ul) {
        ul = document.createElement("ul")
        errors.appendChild(ul)
      }
      let li = document.createElement("li")
      li.innerText = msg
      ul.appendChild(li)
    }
  }

  clearErrors() {
    let errors = this.shadowRoot.querySelector(".errors")
    if (errors) {
      for (let child of errors.children) {
        errors.removeChild(child)
      }
    }
  }

  validate(systemReport) {
    if (systemReport) {
      this.mainNode.reportValidity()
    } else if (false) {  // add a config key to perform a system check and use the messages
      if (this.clearErrors) {
        this.clearErrors()
        if (! this.mainNode.checkValidity()) {
          this.addError(this.mainNode.validationMessage)
        }
      }
    }
  }
  
}


class SystemWrapperField {
  constructor(mainNode) {
    this.mainNode = mainNode
  }

  setValue(value) {
    this.mainNode.value = value
  }

  getValue() {
    return this.mainNode.value
  }

  getName() {
    return this.mainNode.name
  }

  validate(systemReport) {
    if (systemReport) {
      this.mainNode.reportValidity()
    }
  }

  addError(msg) { }

  clearErrors() { }
}


export class BaseYAJSFForm extends BaseYAJSFElement {

  constructor(template, schema=null, data={}, options={}, errors={}) {
    super(template)

    // get data either from the params or the dataset
    const attrs = {"schema": schema, "data": data, "options": options, "errors": errors}
    for (let attr in attrs) {
      try {
        const str = this.dataset[attr]
        this[attr] = JSON.parse(str)
      } catch(e) {
        this[attr] = attrs[attr]
      }
    }

    console.debug(schema, data, options, this.dataset)

    if (this.schema === null) {
      console.warn(
      // throw new Error(
        `No schema provided.  The node containing this form may have been
         refreshed and this component may have been recreated without the
         necessary data. See @link`)
    }

    this.fields = []
  }

  async connectedCallback() {
    await super.connectedCallback()

    if (this.schema) {
      const builder = new FormBuilder(this.schema, this, this.data, this.options, this.errors)
      builder.build()
    }

    this.addInlineFields()
    this.setButtonEvents()

    this.mainNode.addEventListener('submit', event => this.submit(event))
    this.mainNode.addEventListener('formdata', event => console.log('############ formdata', event.formData))
  }

  submit(event) {
    // event.preventDefault()
    console.log("submit")

    this.fields.forEach(field => {
      field.validate(this.mainNode.getAttribute("novalidate") === null)
    })
  }

  addInlineFields() {
    for (let field of this.querySelectorAll("yajsf-input, yajsf-select, yajsf-textarea")) {
      this.addField(field)
    }
    for (let input of this.querySelectorAll("input, select, textarea")) {
      let field = new SystemWrapperField(input)
      this.fields.push(field)
    }
    // could be done more elegantly
    this.fields.forEach(field => {
      if (field.mainNode.tagName === "INPUT") {
        field.mainNode.addEventListener('keydown', event => {
          if (event.key === "Enter") {
            this.mainNode.requestSubmit()
          }
        })
      }
    })
  }

  setButtonEvents() {
    // make buttons outside of the shadow DOM trigger form submitting
    for (let button of this.querySelectorAll("[slot=buttons] button")) {
      if (button.type === "submit") {
        button.addEventListener("click", event => this.mainNode.requestSubmit())
      }
    }

    // a bit overkill, but handle fields reset as well
    for (let [dom, selPrefix] of [[this, '[slot=buttons]>'], [this.shadowRoot, '']]) {
      for (let button of dom.querySelectorAll(`${selPrefix}button[type=reset],input[type=reset]`)) {
        button.addEventListener("click", event => {
          this.fields.forEach(field => {
            field.setValue ? field.setValue('') : field.value = ''
          })
        })
      }
    }
  }

  addField(field) {
    this.fields.push(field)
    let slot = this.mainNode.querySelector('slot')
    this.mainNode.insertBefore(field, slot)
  }

}


export class BaseYAJSFSelect extends BaseYAJSFElement {

  constructor(template) {
    super(template)
    this.select = this.shadowRoot.querySelector('select')
  }

  connectedCallback() {
    super.connectedCallback()
    this.optionsSlot = this.shadowRoot.querySelector('slot[name=options]')

    if (this.optionsSlot) {
      this.optionsSlot.addEventListener('slotchange', () => {
        const options = this.optionsSlot.assignedNodes()
        options.forEach(option => this.addOption(option.cloneNode(true)))
      })
    }
  }

  addOption(node) {
    this.select.appendChild(node)
  }

}


export default function configure(resolve, reject, options={}) {
  for (let name in options) {
    globalConfig[name] = options[name]
  }

  const fields = {
    'Select': BaseYAJSFSelect,
    'Form': BaseYAJSFForm
  }

  // parse the text template by building a DOM
  const templates_root = document.createElement('html')
  templates_root.innerHTML = html_templates

  // register the components as custom elements
  templates_root.querySelectorAll('template').forEach(tpl => {
    let BaseComponent = fields[tpl.getAttribute('html-base-class')] || BaseYAJSFElement
    console.log(`register ${tpl.id}`)
    customElements.define(tpl.id, class extends BaseComponent {
      constructor(...params) {
        super(tpl, ...params)
      }
    })
  })

  resolve()
}


ready = new Promise(configure)
