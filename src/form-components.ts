// @ts-nocheck
import * as globalConfig from './yajsf-config.json'
import html_templates from './templates.html?raw'
import FormBuilder from './builders'


export let ready = null


export class BaseYAJSFElement extends HTMLElement {

  constructor(template) {
    super()

    this.attachShadow({ mode: "open" })
    this.shadowRoot.appendChild(template.content.cloneNode(true))
  }
  
  async connectedCallback() {
    console.log('waiting...', ready)
    await ready
    console.log('Ready!', ready)
    const main_node = this.shadowRoot.querySelector('#main')
    for (let attribute of this.attributes) {
      main_node.setAttribute(attribute.name, attribute.value)
    }

    this.injectTemplateScripts()
  }

  injectTemplateScripts() {
    /**
     * Inject component scripts. Since it uses an eval it raises security
     * concerns and may be subject to removal.
     */
    // see if it may be necessary to have embeded scripts. Should at least
    // be optional.
    // scripts are not run when the template is inserted into the DOM,
    // explicity run them
    if (globalConfig.injectScripts) {
      this.shadowRoot.querySelectorAll('script').forEach(script_node => {
        eval(script_node.text)
      })
    }
  }

  setValue(value) {
    this.shadowRoot.querySelector('#main').value = value
  }

  getValue() {
    return this.shadowRoot.querySelector('#main').value
  }

  getName() {
    return this.shadowRoot.querySelector('#main').name
  }
  
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
    console.log(this.schema, this.data, this.options)

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

    console.log(this.errors)
    if (this.schema) {
      const builder = new FormBuilder(this.schema, this, this.data, this.options, this.errors)
      builder.build()
    }

    const main = this.shadowRoot.querySelector('#main')

    this.addInlineFields(main)
    this.setButtonEvents(main)

    console.log(this.shadowRoot)
    main.addEventListener('submit', event => this.submit(main, event))
    main.addEventListener('formdata', event => console.log('formdata', event.formData))
  }

  addInlineFields(main) {
    for (let field of this.querySelectorAll("yajsf-input, yajsf-select, yajsf-textarea, input, select, textarea")) {
      let input
      if (field.shadowRoot) {
        input = field.shadowRoot.querySelector('input')
      } else if (field.tagName === "INPUT") {
        input = field
      }
      if (input) {
        input.addEventListener('keydown', event => event.key === "Enter" ? main.requestSubmit() : null)
      }
      this.fields.push(field)
    }
  }

  setButtonEvents(main) {
    // make buttons outside of the shadow DOM trigger form submitting
    for (let button of this.querySelectorAll("[slot=buttons] button")) {
      if (button.type === "submit") {
        button.addEventListener("click", event => main.requestSubmit())
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
    this.appendChild(field)
  }

  submit(main, event) {
    event.preventDefault()
    console.log('submit')
    this.fields.forEach(field => {
      let name = field.getName ? field.getName() : field.name
      let value = field.getValue ? field.getValue() : field.value

      let hiddenInput = main.querySelector(`input[type=hidden][name=${name}]`)
      if (hiddenInput) {
        hiddenInput.value = value
      } else {
        hiddenInput = document.createElement('input')
        hiddenInput.type = 'hidden'
        hiddenInput.name = name
        hiddenInput.value = value
        main.appendChild(hiddenInput)
      }
    })

    const formdata = new FormData(main)
    console.log(formdata)
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
