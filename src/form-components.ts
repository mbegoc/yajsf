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

  getValue() {
    return this.shadowRoot.querySelector('#main').value
  }

  getName() {
    return this.shadowRoot.querySelector('#main').name
  }
  
}


export class BaseYAJSFForm extends BaseYAJSFElement {

  constructor(template, schema=null, data={}, options={}) {
    super(template)

    // get data either from the params or the dataset
    const attrs = {"schema": schema, "data": data, "options": options}
    for (let attr in attrs) {
      try {
        const str = this.dataset[attr]
        this[attr] = JSON.parse(str)
      } catch(e) {
        this[attr] = attrs[attr]
      }
    }

    console.log(schema, data, options, this.dataset)
    console.log(this.schema, this.data, this.options)

    if (this.schema === null) {
      throw new Error(
        `No schema provided.  The node containing this form may have been
         refreshed and this component may have been recreated without the
         necessary data. See @link`)
    }

    this.fields = []
  }

  async connectedCallback() {
    await super.connectedCallback()

    const builder = new FormBuilder(this.schema, this, this.data, this.options)
    builder.build()

    console.log(this.shadowRoot)
    const main = this.shadowRoot.querySelector('#main')
    main.addEventListener('submit', event => this.submit(main, event))
  }

  submit(main, event) {
    console.log('####', this)
    this.fields.forEach(field => {
      console.log(field)
      const hiddenInput = document.createElement('input')
      hiddenInput.type = 'hidden'
      hiddenInput.value = field.getValue ? field.getValue() : ''
      hiddenInput.name = field.getName ? field.getName() : ''
      main.appendChild(hiddenInput)
    })
  }

  addField(field) {
    this.fields.push(field)
    this.appendChild(field)
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
