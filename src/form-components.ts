import html_templates from './templates.html?raw'


export class BaseYAJSFElement extends HTMLElement {

  constructor(template) {
    super()
    this.attachShadow({ mode: "open" })
    this.shadowRoot.appendChild(template.content.cloneNode(true))
  }
  
  connectedCallback() {
    const main_node = this.shadowRoot.querySelector('#main')
    for (let attribute of this.attributes) {
      main_node.setAttribute(attribute.name, attribute.value)
    }

    // see if it may be necessary to have embeded scripts
    // this.shadowRoot.querySelectorAll('script').forEach(script_node => {
    //   eval(script_node.text)
    // })
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
      console.log('hmmm')
      this.optionsSlot.addEventListener('slotchange', () => {
        console.log('!!!')
        const options = this.optionsSlot.assignedNodes()
        options.forEach(option => this.addOption(option.cloneNode(true)))
      })
    }
  }

  addOption(node) {
    this.select.appendChild(node)
  }
}


export default class BaseYAJSFForm extends BaseYAJSFElement {
  constructor(template, schema, data, options) {
    super(template)
    this.schema = schema
    this.data = data || {}
    this.options = options || {}
  }
  
  connectedCallback() {
    super.connectedCallback()
  }

}


const fields = {
  'Select': BaseYAJSFSelect,
  'Form': BaseYAJSFForm
}


const templates_root = document.createElement('html')
templates_root.innerHTML = html_templates
await templates_root.querySelectorAll('template').forEach(tpl => {
  let BaseComponent = fields[tpl.getAttribute('html-base-class')] || BaseYAJSFElement
  customElements.define(tpl.id, class extends BaseComponent {
    constructor(...params) {
      super(tpl, ...params)
    }
  })
})
