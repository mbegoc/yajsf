// @ts-nocheck
import html_templates from './templates.html?raw'
import FormBuilder from './builders'
import { ready, settings } from "./config"


// Parse the text template by building a DOM
const templates_root = document.createElement('html')
templates_root.innerHTML = html_templates


/**
 * Set attributes on the main node (i.e. actual form field of the component)
 * from the component attributes. It allow to use a custom components with
 * the same interface than the underlying widget.
 */
export function setAttributes(self) {
    for (let attribute of self.attributes) {
      self.mainNode.setAttribute(attribute.name, attribute.value)
    }
}


/**
 * Inject component scripts.
 *
 * This should have been done in a base common class, but because of
 * lack of multiple inheritence support in JS, it's an helper function.
 *
 * See if we actually need to be able to embed scripts in templates.
 */
export function injectTemplateScripts(self) {
    if (settings.injectScripts) {
        self.shadowRoot.querySelectorAll('script').forEach(script_node => {
            let newScript = document.createElement('script')
            newScript.innerText = script_node.innerText
            self.shadowRoot.replaceChild(newScript, script_node)
        })
    }
}


/**
 * Wrap a system widget into a YAJSF component so it can be used within a
 * a YAJSF form. Probably not useful unless if extending the YAJSFForm class.
 */
export function wrapSystemField(widget) {
    switch (widget.tagName) {
        case "INPUT":
            return new YAJSFInput(widget)
            break;
        case "SELECT":
            return new YAJSFSelect(widget)
            break;
        case "TEXTAREA":
            return new YAJSFTextArea(widget)
            break;
        default:
            throw new YAJSFError("Unsupported element used with a YAJSF form.")
    }
}


class YAJSFError extends Error {
    name = "YAJSFError"
}


interface YAJSFComponent {
    mainNode
    static template
}


export class YAJSFForm extends HTMLElement implements YAJSFComponent {
    static template = templates_root.querySelector('#yajsf-form')
    mainNode = null

    constructor(schema=null, data={}, options={}, errors={}) {
        super()

        this.template = this.__proto__.constructor.template
        if (this.id) {
            this.internal_id = this.id
        } else {
            // quick & dirty
            this.internal_id = Math.round(Math.random()*10000)
        }

        // get data either from the params or the dataset
        const attrs = {"schema": schema, "data": data, "options": options, "errors": errors}
        for (let attr in attrs) {
            try {
                const str = this.dataset[attr]
                this[attr] = JSON.parse(str)
            } catch(exc) {
                this[attr] = attrs[attr]
            }
        }

        console.groupCollapsed(`YAJSF ― Form creation ${this.internal_id}`)
        console.debug(this)
        console.debug("Schema", schema)
        console.debug("Data", data)
        console.debug("Options", options)
        console.debug("Dataset", this.dataset)

        if (this.schema === null) {
            console.warn(
                // throw new Error(
                `No schema provided.  The node containing this form may have been
         refreshed and this component may have been recreated without the
         necessary data. See @link`)
        }

        this.fields = []

        this.attachShadow({ mode: "open" })
        this.shadowRoot.appendChild(this.template.content.cloneNode(true))
        this.mainNode = this.shadowRoot.querySelector('.main')
    }

    async connectedCallback() {

        console.log('waiting...', ready)
        await ready
        console.log('Ready!', ready)

        if (this.schema) {
            const builder = new FormBuilder(this.schema, this, this.data, this.options, this.errors)
            builder.build()
        }

        setAttributes(this)
        this.addInlineFields()
        this.setButtonEvents()
        injectTemplateScripts(this)

        console.groupEnd(`YAJSF ― Form creation ${this.internal_id}`)

        this.mainNode.addEventListener('submit', event => this.submit(event))
        this.mainNode.addEventListener('formdata', function(event) {
            console.info("YAJSF ― FormData available", event.formData)
        })
    }

    validate() {
        // I'm surprised there are no event to trigger form validation.
        // Did I miss something?
        let valid = true
        this.fields.forEach(field => {
            valid = field.validate(!this.mainNode.noValidate) && valid
        })

        // @TODO: Perform a JSON-schema validation for the whole form

        return valid
    }

    submit(event) {
        console.info("YAJSF ― Form submission")

        if (!this.validate() || settings.preventHTTPSubmit) {
            event.preventDefault()
            // will trigger the formdata event so subscribers to formdata
            // event will be notified
            this.getFormData()
        }
    }

    getFormData() {
        return new FormData(this.mainNode)
    }

    addInlineFields() {
        for (let field of this.querySelectorAll("y-input, y-select, y-textarea")) {
            this.addField(field)
        }
        for (let input of this.querySelectorAll("input, select, textarea")) {
            try {
                let field = wrapSystemField(input)
                this.addField(field)
            } catch(exc) {
                 if (exc.name === "YAJSFError") {
                     console.warn(exc)
                 } else {
                     throw exc
                 }
            }

        }
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


export class YAJSFBaseWidget extends HTMLElement implements YAJSFComponent {
    static formAssociated = true
    mainNode = null

    constructor(mainNode=null) {
        super()
        // access to the static template from the child instance. See if it
        // can be done cleaner
        this.template = this.__proto__.constructor.template

        this.attachShadow({ mode: "open" })
        if (mainNode) {
            this.mainNode = mainNode
            // @FIXME: not sure it's a good idea to do that
            this.shadowRoot.appendChild(this.mainNode)
        } else {
            this.shadowRoot.appendChild(this.template.content.cloneNode(true))
            this.mainNode = this.shadowRoot.querySelector('.main')
        }
        this.internals_ = this.attachInternals()
    }

    async connectedCallback() {
        await ready

        setAttributes(this)
        injectTemplateScripts(this)

        if (this.internals_.form) {
            this.internals_.setFormValue(this.mainNode.value)
            this.mainNode.addEventListener("change", e => {
                this.internals_.setFormValue(this.mainNode.value)
            })
            this.internals_.form.addEventListener('submit', e => {
                this.internals_.setFormValue(this.mainNode.value)
            }, {capture: true})

            this.internals_.form.addEventListener('reset', e => {
                this.mainNode.value = ""
            })
        }
    }

    validate(systemReport) {
        if (settings.integrateSystemValidationMessage) {
            if (this.clearErrors) {
                this.clearErrors()
                if (! this.mainNode.checkValidity()) {
                    this.addError(this.mainNode.validationMessage)
                    return false
                }
            }
        } else if (systemReport) {
            return this.mainNode.reportValidity()
        }
        return true
    }
    
    setErrors(errors) {
        this.clearErrors()
        errors.forEach(error => {
            this.addError(error)
        })
    }

    addError(error) {
        let errors = this.shadowRoot.querySelector(".errors")
        if (errors) {
            let ul = errors.querySelector("ul")
            if (! ul) {
                ul = document.createElement("ul")
                errors.appendChild(ul)
            }
            let li = document.createElement("li")
            li.innerText = error
            ul.appendChild(li)
        } else {
            console.groupCollapsed("YAJSF ― No container to display error.")
            console.info("Error message was", error)
            console.groupEnd("YAJSF ― No container to display error.")
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

    setAttributes(attributes) {
        for (let name in attributes) {
          this.mainNode.setAttribute(name, attributes[name])
        }
    }

}

export class YAJSFInput extends YAJSFBaseWidget {
    static template = templates_root.querySelector('#yajsf-input')

    connectedCallback() {
        super.connectedCallback()

        if (this.internals_.form) {
            this.mainNode.addEventListener('keydown', event => {
                if (event.key === "Enter") {
                    this.internals_.form.requestSubmit()
                }
            })
        }
    }

}


export class YAJSFSelect extends YAJSFBaseWidget {
    static template = templates_root.querySelector('#yajsf-select')

    connectedCallback(mainNode=null) {
        super.connectedCallback(mainNode)

        this.optionsSlot = this.shadowRoot.querySelector('slot[name=options]')

        if (this.optionsSlot) {
            this.optionsSlot.addEventListener('slotchange', () => {
                const options = this.optionsSlot.assignedNodes()
                options.forEach(option => this.addOption(option.cloneNode(true)))
            })
        }
    }

    addOption(node) {
        this.mainNode.appendChild(node)
    }

}


export class YAJSFTextArea extends YAJSFBaseWidget {
    static template = templates_root.querySelector('#yajsf-textarea')

}


