import { parser, lint } from '@exodus/schemasafe'

import type {
    Schema,
    PropertyType,
    Property,
    FieldOptions,
    FieldOption,
    Enum,
} from "./types"

import htmlTemplate from './templates.html?raw'
import { FormBuilder } from './builders'
import { ready, settings } from "./config"
import { SchemaHelper } from "./utils/schema"


// Parse the text template by building a DOM
let templatesRoot: HTMLHtmlElement = document.createElement('html')
templatesRoot.innerHTML = htmlTemplate


/**
 * Set attributes on the main node (i.e. actual form field of the component)
 * from the component attributes. It allow to use a custom components with
 * the same interface than the underlying widget.
 */
export function setAttributes(self: YAJSFForm | YAJSFField): void {
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
export function injectTemplateScripts(self: YAJSFForm | YAJSFField): void {
    if (settings.injectScripts) {
        for (let scriptNode of self.shadowRoot!.querySelectorAll('script')) {
            let newScript = document.createElement('script')
            newScript.innerText = scriptNode.innerText
            self.shadowRoot!.replaceChild(newScript, scriptNode)
        }
    }
}


/**
 * Wrap a system widget into a YAJSF component so it can be used within a
 * YAJSF form. Probably not useful unless extending the YAJSFForm class.
 */
export function wrapSystemField(widget: HTMLElement): YAJSFComponent {
    switch (widget.tagName) {
        case "INPUT":
            return new YAJSFInput(widget)
            break
        case "SELECT":
            return new YAJSFSelect(widget)
            break
        case "TEXTAREA":
            return new YAJSFTextArea(widget)
            break
        default:
            throw new YAJSFError("Unsupported element used with a YAJSF form.")
    }
}


// @TODO: should be moved elsewhere
export class YAJSFError extends Error { }


interface YAJSFComponent {
    static template: HTMLTemplateElement
    protected attributes: NamedNodeMap
}


export class YAJSFForm extends HTMLElement implements YAJSFComponent {
    static template = templatesRoot.querySelector('#yajsf-form') as HTMLTemplateElement
    protected mainNode: HTMLFormElement
    protected internalId: string
    protected schema?: Schema
    protected schemaHelper: SchemaHelper
    protected fields: Map = new Map()

    constructor(schema?: Schema = null, data: {[key: string]: string} = {},
                options: FieldOptions = {}, errors: {[key: string]: any}[] = {}) {
        super()

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
                `No schema provided.  The node containing this form may have
                 been refreshed and this component may have been recreated
                 without the necessary data. See @link`)
        } else {
            let schemaErrors = lint(this.schema)
            if (schemaErrors = lint(this.schema)) {
                console.warn("YAJSF ― Schema errors were found", schemaErrors)
            }
            this.schemaHelper = new SchemaHelper(this.schema)
        }

        this.attachShadow({ mode: "open" })
        let template = (this.constructor as typeof this).template
        this.shadowRoot!.appendChild(template.content.cloneNode(true))
        this.mainNode = this.shadowRoot!.querySelector('.main')!
    }

    connectedCallback() {
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

        this.mainNode.addEventListener('submit', () => this.submit(event))
        this.mainNode.addEventListener('formdata', event => {
            console.info("YAJSF ― FormData available", event.formData)
        })
    }

    validate(): Boolean {
        return this.systemValidate() && this.schemaValidate()
    }

    systemValidate(): Boolean {
        return this.fields.values().reduce(
            field => field.validate(!this.mainNode.noValidate) && valid, true)
    }

    /**
     * @FIXME: Exploratory code (too complex IMAO)
     */
    schemaValidate(): Boolean {
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
        // will trigger a formdata event. Probably not ideal if validation
        // fail
        let formdata = new FormData(this.mainNode)
        let map = formdata.entries().reduce((result: Map, item) => {
            result.set(item[0], item[1])
            return result
        }, new Map())
        let validation = validate(JSON.stringify(Object.fromEntries(map)))
        if (! validation.valid) {
            let errors = validation.errors.reduce((result: Map, error) => {
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

    submit(event: SubmitEvent) {
        console.info("YAJSF ― Form submission")

        if (!this.validate() || settings.preventHTTPSubmit) {
            event.preventDefault()
            // will trigger the formdata event so subscribers to formdata
            // event will be notified
            this.getFormData()
        }
    }

    getFormData(): FormData {
        return new FormData(this.mainNode)
    }

    addInlineFields(): void {
        for (let field of this.querySelectorAll(
            "y-input, y-select, y-textarea, input, select, textarea"
        )) {
            if (field.tagName) {
                try {
                    field = wrapSystemField(field)
                } catch(exc) {
                     if (exc?.constructor.name === "YAJSFError") {
                         console.warn(exc)
                     } else {
                         throw exc
                     }
                }
            }
            this.addField(field)
        }
    }

    setButtonEvents(): void {
        // make buttons outside of the shadow DOM trigger form submitting
        for (let button of this.querySelectorAll("[slot=buttons] button")) {
            if ((button as HTMLButtonElement).type === "submit") {
                button.addEventListener("click", () => this.mainNode.requestSubmit())
            }
        }

        // a bit overkill, but handle fields reset as well
        for (let [dom, selPrefix] of [[this, '[slot=buttons]>'], [this.shadowRoot, '']]) {
            for (let button of dom.querySelectorAll(`${selPrefix}button[type=reset],input[type=reset]`)) {
                button.addEventListener("click", () => {
                    for (let field of this.fields.values()) {
                        field.setValue('')
                    }
                })
            }
        }
    }

    addField(field: YAJSFField | HTMLElement) {
        this.fields.set(field.name, field)
        let slot = this.mainNode.querySelector('slot')
        this.mainNode.insertBefore(field, slot)
    }

}


export class YAJSFField extends HTMLElement implements YAJSFComponent {
    static template: HTMLTemplateElement
    static formAssociated = true
    protected mainNode: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    protected internals_: ElementInternals

    constructor(mainNode: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null) {
        super()

        this.attachShadow({ mode: "open" })
        if (mainNode) {
            this.mainNode = mainNode
            // @FIXME: not sure it's a good idea to do that
            this.shadowRoot!.appendChild(this.mainNode)
        } else {
            let template = (this.constructor as typeof YAJSFField).template
            this.shadowRoot!.appendChild(template.content.cloneNode(true))
            this.mainNode = this.shadowRoot!.querySelector('.main')!
        }
        this.internals_ = this.attachInternals()!
    }

    connectedCallback() {
        setAttributes(this)
        injectTemplateScripts(this)

        if (this.internals_.form) {
            this.internals_.setFormValue(this.mainNode.value)
            this.mainNode.addEventListener("change", () => {
                this.internals_.setFormValue(this.mainNode.value)
            })
            this.internals_.form.addEventListener('submit', () => {
                this.internals_.setFormValue(this.mainNode.value)
            }, {capture: true})

            this.internals_.form.addEventListener('reset', () => {
                this.mainNode.value = ""
            })
        }
    }

    get name(): string {
        return this.mainNode.name
    }

    validate(systemReport: Boolean): Boolean {
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
    
    setErrors(errors: string[]): void {
        this.clearErrors()
        for (let error of errors) {
            this.addError(error)
        }
    }

    addError(error: string): void {
        let container = this.shadowRoot!.querySelector(".errors")
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
            console.groupEnd()
        }
    }

    clearErrors(): void {
        let errors = this.shadowRoot!.querySelector(".errors")
        if (errors) {
            for (let child of errors.children) {
                errors.removeChild(child)
            }
        }
    }

    setAttributes(attributes: {[key: string]: string}): void {
        for (let [name, value] of Object.entries(attributes)) {
            this.mainNode.setAttribute(name, value)
        }
    }

    setValue(value: string) {
        this.mainNode.value = value
    }

}


export class YAJSFInput extends YAJSFField {
    static template = templatesRoot.querySelector('#yajsf-input') as HTMLTemplateElement

    connectedCallback() {
        super.connectedCallback()

        if (this.internals_.form) {
            this.mainNode.addEventListener('keydown', event => {
                if ((event as KeyboardEvent).key === "Enter") {
                    // the "!" --'
                    this.internals_!.form!.requestSubmit()
                }
            })
        }
    }

}


export class YAJSFSelect extends YAJSFField {
    static template = templatesRoot.querySelector('#yajsf-select') as HTMLTemplateElement

    connectedCallback() {
        super.connectedCallback()

        let optionsSlot = this.shadowRoot!.querySelector('slot[name=options]') as HTMLSlotElement

        if (optionsSlot) {
            optionsSlot.addEventListener('slotchange', () => {
                let options = optionsSlot.assignedNodes()
                for (let option of options) {
                    this.addOption(option.cloneNode(true) as HTMLOptionElement)
                }
            })
        }
    }

    addOption(node: HTMLOptionElement) {
        this.mainNode.appendChild(node)
    }

}


export class YAJSFTextArea extends YAJSFField {
    static template = templatesRoot.querySelector('#yajsf-textarea') as HTMLTemplateElement

}
