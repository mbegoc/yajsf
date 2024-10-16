import { parser, lint, Schema as SchemaSafe } from '@exodus/schemasafe'

import type {
    InputAttributes,
    HTMLField,
    FormSettings,
} from "./types"

import { settings } from "./config"
import { getLogger } from "./utils/logging"
import htmlTemplate from './templates/web-components.html?raw'
import { FormBuilder } from './builders'
import { SchemaHelper } from "./utils/schema"


const logger = getLogger("Comoponents", "Steel")


// Parse the text template by building a DOM
let templatesRoot = document.createElement('html')
templatesRoot.innerHTML = htmlTemplate


/**
 * Set attributes on the main node (i.e. actual form field of the component)
 * from the component attributes. It allow to use a custom components with
 * the same interface than the underlying widget.
 */
export function setAttributes(self: YAJSFForm | YAJSFField) {
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
export function injectTemplateScripts(self: YAJSFForm | YAJSFField) {
    if (settings.injectScripts) {
        for (let scriptNode of self.shadowRoot!.querySelectorAll('script')) {
            let newScript = document.createElement('script')
            newScript.innerText = scriptNode.innerText
            self.shadowRoot!.replaceChild(newScript, scriptNode)
        }
    }
}


/**
 * Wrap a system field into a YAJSF component so it can be used within a
 * YAJSF form. Probably not useful unless extending the YAJSFForm class.
 */
export function wrapSystemField(field: HTMLField): YAJSFField {
    switch (field.tagName) {
        case "INPUT":
            if (field.type === "hidden") {
                return new YAJSFField(field)
            } else {
                return new YAJSFInput(field)
            }
            break
        case "SELECT":
            return new YAJSFSelect(field)
            break
        case "TEXTAREA":
            return new YAJSFTextArea(field)
            break
        default:
            throw new YAJSFError("Unsupported element used with a YAJSF form.")
    }
}


// @TODO: should be moved elsewhere
export class YAJSFError extends Error { }


export class YAJSFForm extends HTMLElement {
    static template = templatesRoot.querySelector('#yajsf-form') as HTMLTemplateElement
    mainNode: HTMLFormElement
    internalId: string
    protected schema?: FormSettings["schema"]
    protected data?: FormSettings["data"]
    protected options?: FormSettings["options"]
    protected errors?: FormSettings["errors"]
    protected schemaHelper!: SchemaHelper
    protected fields: Map<string, YAJSFField> = new Map()

    constructor(formSettings: FormSettings) {
        super()

        if (this.id) {
            this.internalId = this.id
        } else {
            // quick & dirty
            this.internalId = String(Math.round(Math.random()*10000))
        }

        logger.time(`Form ${this.internalId}`)

        if (! formSettings) {
            let attrs: (keyof FormSettings)[] = [
                "schema", "data", "options", "errors"]
            for (let attr of attrs) {
                if (this.dataset[attr]) {
                    try{
                        formSettings = Object.assign(
                            formSettings || {},
                            {[attr]: JSON.parse(this.dataset[attr])},
                        )
                    } catch(exc) {
                        logger.warn(`YAJSF ― Couldn't load data-${attr}. ` +
                                    `Continue with an empty value.\n`, exc)
                    }
                }
            }
        }


        logger.groupCollapsed(`YAJSF ― Form creation ${this.internalId}`)
        logger.debug(`Form ${this.internalId}`, this)
        logger.debug("Dataset", this.dataset)

        if (! formSettings) {
            logger.warn(
                // throw new Error(
                `No schema provided.  The node containing this form may have
                 been refreshed and this component may have been recreated
                 without the necessary data. See @link`)
        } else {
            this.schema = formSettings.schema
            this.data = formSettings.data
            this.options = formSettings.options
            this.errors = formSettings.errors

            let schemaErrors = lint(this.schema as SchemaSafe)
            if (schemaErrors ) {
                logger.warn("YAJSF ― Schema errors were found", schemaErrors)
            }
            this.schemaHelper = new SchemaHelper(this.schema)
        }

        logger.debug("Schema", this.schema)
        logger.debug("Data", this.data)
        logger.debug("Options", this.options)
        logger.debug("Errors", this.errors)

        this.attachShadow({ mode: "open" })
        let template = YAJSFForm.template
        this.shadowRoot!.appendChild(template.content.cloneNode(true))
        this.mainNode = this.shadowRoot!.querySelector('.main')!
    }

    connectedCallback() {
        if (this.schema) {
            let builder = new FormBuilder(
                this.schema,
                this,
                this.data,
                this.options,
            )
            builder.build()
        }

        setAttributes(this)
        this.addInlineFields()
        this.setButtonEvents()
        injectTemplateScripts(this)

        // display initial errors
        if (this.errors) {
            for (let error of this.errors) {
                for (let loc of error.loc) {
                    let field = this.fields.get(loc)
                    if (field) {
                        field.addError(error.msg)
                    }
                }
            }
        }

        this.mainNode.addEventListener<"submit">("submit", event =>
            this.submit(event))
        this.mainNode.addEventListener('formdata', event =>
            logger.info("YAJSF ― FormData available", event.formData))

        logger.timeLog(`Form ${this.internalId}`, "Form is generated")
        logger.groupEnd()
    }

    validate(): boolean {
        return this.systemValidate() && this.schemaValidate()
    }

    systemValidate(): boolean {
        return (this.fields.values() as any).reduce(
            (valid: boolean, field: YAJSFField) =>
                field.validate(! this.mainNode.noValidate) && valid, true)
    }

    /**
     * @FIXME: Exploratory code (too complex IMAO)
     */
    schemaValidate(): boolean {
        let validate = parser(this.schema as SchemaSafe,{
            $schemaDefault: "https://json-schema.org/draft/2020-12/schema",
            mode: "default",
            allErrors: true,
            includeErrors: true,
            extraFormats: true,
            formats: {
                "password": /^[\S]+$/,
                "uuid4": /^[a-z0-9-]+$/,
            }
        })
        // will trigger a formdata event. Probably not ideal if validation
        // fail
        let formdata = new FormData(this.mainNode)
        let map = (formdata.entries() as any).reduce((result: Map<string, string>, item: string[]) => {
            result.set(item[0], item[1])
            return result
        }, new Map())
        let validation = validate(JSON.stringify(Object.fromEntries(map)))
        if (! validation.valid) {
            let errors = validation.errors!.reduce((result: Map<string, string[]>, error: {instanceLocation: string, keywordLocation: string}) => {
                let fieldName = error.instanceLocation.slice(2)
                let rule = error.keywordLocation
                if (result.has(fieldName)) {
                    result.get(fieldName)!.push(rule)
                } else {
                    result.set(fieldName, [rule])
                }
                return result
            }, new Map())

            for (let errorList of errors.entries()) {
                let name = errorList[0]
                let field = this.mainNode.querySelector<YAJSFField>(`[name=${name}]`)
                if (! field) {
                    continue  // nested forms
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

        return validation.valid
    }

    submit(event: SubmitEvent) {
        logger.info("YAJSF ― Form submission")

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

    addInlineFields() {
        for (let field of this.querySelectorAll<YAJSFField>(
                "y-input, y-select, y-textarea")) {
            this.addField(field)
        }
        for (let field of this.querySelectorAll<HTMLField>(
                "input, select, textarea")) {
            this.addField(wrapSystemField(field))
        }
    }

    setButtonEvents() {
        // make buttons outside of the shadow DOM trigger form submitting
        for (let button of this.querySelectorAll<HTMLButtonElement>(
                "[slot=buttons] button")) {
            if (button.type === "submit") {
                button.addEventListener("click", () => this.mainNode.requestSubmit())
            }
        }

        // a bit overkill, but handle fields reset as well
        for (let [dom, selPrefix] of [[this, '[slot=buttons]>'], [this.shadowRoot, '']]) {
            for (let button of (dom as HTMLElement).querySelectorAll<YAJSFField>(
                    `${selPrefix}button[type=reset],input[type=reset]`)) {
                button.addEventListener("click", () => {
                    for (let field of this.fields.values()) {
                        field.setValue('')
                    }
                })
            }
        }
    }

    addField(field: YAJSFField) {
        this.fields.set(field.name, field)
        let slot = this.mainNode.querySelector('slot')
        this.mainNode.insertBefore(field, slot)
    }

}


export class YAJSFField extends HTMLElement {
    static template = templatesRoot.querySelector('#yajsf-system') as HTMLTemplateElement
    static formAssociated = true
    mainNode: HTMLField
    protected internals_: ElementInternals

    constructor(mainNode: HTMLField | null = null) {
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

    validate(systemReport: boolean): boolean {
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
    
    setErrors(errors: string[]) {
        this.clearErrors()
        for (let error of errors) {
            this.addError(error)
        }
    }

    addError(error: string) {
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
            logger.groupCollapsed("YAJSF ― No container to display error.")
            logger.info("Error message was", error)
            logger.groupEnd()
        }
    }

    clearErrors() {
        let errors = this.shadowRoot!.querySelector(".errors")
        if (errors) {
            for (let child of errors.children) {
                errors.removeChild(child)
            }
        }
    }

    setAttributes(attributes: InputAttributes) {
        for (let [name, value] of Object.entries(attributes)) {
            if (name === "title") {
                if (attributes.type !== "hidden") {
                    this.setTitle(value as string)
                }
            } else {
                if (name === "name") {
                    // needed to include the field into the generated formData
                    this.setAttribute(name, value as string)
                }
                this.mainNode.setAttribute(name, value as string)
            }
        }
    }

    setValue(value: string) {
        this.mainNode.value = value
    }

    setTitle(title: string) {
        if (this.mainNode.type !== "hidden") {
            this.appendChild(document.createTextNode(title))
        }
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

        let optionsSlot = this.shadowRoot!.querySelector<HTMLSlotElement>('slot[name=options]')

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
