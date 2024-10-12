// @ts-nocheck
import { parser, lint, validator } from '@exodus/schemasafe'

import htmlTemplate from './templates.html?raw'
import { FormBuilder } from './builders'
import { ready, settings } from "./config"
import { SchemaHelper } from "./utils/schema"


// Parse the text template by building a DOM
let templatesRoot: HTMLElement = document.createElement('html')
templatesRoot.innerHTML = htmlTemplate


/**
 * Set attributes on the main node (i.e. actual form field of the component)
 * from the component attributes. It allow to use a custom components with
 * the same interface than the underlying widget.
 */
export function setAttributes(self: YAJSFComponent): void {
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
export function injectTemplateScripts(self: YAJSFComponent): void {
    if (settings.injectScripts) {
        for (let scriptNode of self.shadowRoot.querySelectorAll('script')) {
            let newScript = document.createElement('script')
            newScript.innerText = scriptNode.innerText
            self.shadowRoot.replaceChild(newScript, scriptNode)
        }
    }
}


/**
 * Wrap a system widget into a YAJSF component so it can be used within a
 * a YAJSF form. Probably not useful unless if extending the YAJSFForm class.
 */
export function wrapSystemField(widget: HTMLElement): YAJSFComponent {
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


class YAJSFError extends Error { }


interface YAJSFComponent {
    mainNode: HTMLElement
    static template: HTMLNode
}


export class YAJSFForm extends HTMLElement implements YAJSFComponent {
    static template = templatesRoot.querySelector('#yajsf-form')
    mainNode = null
    protected template: HTMLNode
    protected internalId: string

    constructor(schema: dict[any] = null, data: dict[any] = {}, options: dict[any] = {}, errors: dict[any] = {}) {
        super()

        this.template = this.constructor.template
        if (this.id) {
            this.internalId = this.id
        } else {
            // quick & dirty
            this.internalId = Math.round(Math.random()*10000)
        }

        // get data either from the params or the dataset
        let attrs = {"schema": schema, "data": data,
                       "options": options, "errors": errors}
        for (let attr in attrs) {
            try {
                let str = this.dataset[attr]
                this[attr] = JSON.parse(str)
            } catch(exc) {
                this[attr] = attrs[attr]
            }
        }

        console.groupCollapsed(`YAJSF ― Form creation ${this.internalId}`)
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
        } else {
            let schemaErrors = lint(this.schema)
            if (schemaErrors = lint(this.schema)) {
                console.warn("YAJSF ― Schema errors were found", schemaErrors)
            }
            this.schemaHelper = new SchemaHelper(this.schema)
        }

        this.fields = new Map()

        this.attachShadow({ mode: "open" })
        this.shadowRoot.appendChild(this.template.content.cloneNode(true))
        this.mainNode = this.shadowRoot.querySelector('.main')
    }

    async connectedCallback() {
        console.log('waiting...', ready)
        await ready
        console.log('Ready!', ready)

        if (this.schema) {
            let builder = new FormBuilder(this.schema, this, this.data, this.options)
            builder.build()
        }

        setAttributes(this)
        this.addInlineFields()
        this.setButtonEvents()
        injectTemplateScripts(this)

        // display initial errors
        for (let error of this.errors) {
            for (let loc of error.loc) {
                let field = this.fields.get(loc)
                if (field) {
                    field.addError(error.msg)
                }
            }
        }

        console.groupEnd(`YAJSF ― Form creation ${this.internalId}`)

        this.mainNode.addEventListener('submit', event => this.submit(event))
        this.mainNode.addEventListener('formdata', function(event) {
            console.info("YAJSF ― FormData available", event.formData)
        })
    }

    validate() {
        return this.systemValidate() && this.schemaValidate()
    }

    systemValidate() {
        return this.fields.values().reduce(
            field => field.validate(!this.mainNode.noValidate) && valid, true)
    }

    /**
     * @FIXME: Exploratory code (too complex IMAO)
     */
    schemaValidate() {
        let validate = parser(this.schema, {
            $schemaDefault: "https://json-schema.org/draft/2020-12/schema",
            mode: "default",
            allErrors: true,
            includeErrors: true,
            extraFormats: true,
            formats: {
                password: /^[^\s]$/,
                uuid4: /^[^\W_]{8}-([^\W_]{8}){3}-[^\W_]{12}$/,
            },
        })
        let formdata = new FormData(this.mainNode)
        let map = formdata.entries().reduce((result, item) => {
            result.set(item[0], item[1])
            return result
        }, new Map())
        let validation = validate(JSON.stringify(Object.fromEntries(map)))
        if (! validation.valid) {
            let errors = validation.errors.reduce((result, error) => {
                let fieldName = error.instanceLocation.slice(2)
                let rule = error.keywordLocation
                if (result.has(fieldName)) {
                    result.get(fieldName).push(rule)
                } else {
                    result.set(fieldName, [rule])
                }
                return result
            }, new Map())

            for (let errorList of errors.entries()) {
                let name = errorList[0]
                let field = this.mainNode.querySelector(`[name=${name}]`)
                if (! field) {
                    return  // nested forms
                }
                let criterions = errorList[1]
                if (criterions.indexOf("required") !== -1) {
                    field.setErrors(["This field is required."])
                } else {
                    field.clearErrors()
                    for (let error of criterions) {
                        let which = error.split("/").pop()
                        let what = this.schemaHelper.getNode(error)
                        field.addError(`The ${which} is not ${what}`)
                    }
                }
            }
        }
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
        for (let field of this.querySelectorAll(
            "y-input, y-select, y-textarea, input, select, textarea"
        )) {
            if (field.tagName) {
                try {
                    field = wrapSystemField(input)
                } catch(exc) {
                     if (exc.constructor.name === "YAJSFError") {
                         console.warn(exc)
                     } else {
                         throw exc
                     }
                }
            }
            this.addField(field)

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
                    for (let field of this.fields.values()) {
                        field.setValue('')
                    }
                })
            }
        }
    }

    addField(field) {
        this.fields.set(field.name, field)
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

    get name() {
        return this.mainNode.name
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
        for (let error of errors) {
            this.addError(error)
        }
    }

    addError(error) {
        let container = this.shadowRoot.querySelector(".errors")
        if (container) {
            let ul = container.querySelector("ul")
            if (! ul) {
                ul = document.createElement("ul")
                container.appendChild(ul)
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
        for (let [name, value] of Object.entries(attributes)) {
            this.mainNode.setAttribute(name, value)
        }
    }

}


export class YAJSFInput extends YAJSFBaseWidget {
    static template = templatesRoot.querySelector('#yajsf-input')

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
    static template = templatesRoot.querySelector('#yajsf-select')

    connectedCallback(mainNode=null) {
        super.connectedCallback(mainNode)

        this.optionsSlot = this.shadowRoot.querySelector('slot[name=options]')

        if (this.optionsSlot) {
            this.optionsSlot.addEventListener('slotchange', () => {
                let options = this.optionsSlot.assignedNodes()
                for (let option of options) {
                    this.addOption(option.cloneNode(true))
                }
            })
        }
    }

    addOption(node) {
        this.mainNode.appendChild(node)
    }

}


export class YAJSFTextArea extends YAJSFBaseWidget {
    static template = templatesRoot.querySelector('#yajsf-textarea')

}
