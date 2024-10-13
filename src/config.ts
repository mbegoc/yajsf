// @ts-nocheck

import * as baseConfig from './settings.json'
import {
    YAJSFForm,
    YAJSFInput,
    YAJSFSelect,
    YAJSFTextArea,
} from "./components"


// create a copy without the false writable flag
// @TODO: can we do that more elegantly?
export const settings = Object.fromEntries(Object.entries(baseConfig))


let setReady = null
export const ready = new Promise((resolve, reject) => setReady = resolve)


export function registerComponents(options={}) {
    console.groupCollapsed("YAJSF config")
    console.time("YAJSF Init Time")

    // register the components as custom elements
    console.info("Register y-form")
    customElements.define("y-form", YAJSFForm)

    console.info("Register y-input")
    customElements.define("y-input", YAJSFInput)

    console.info("Register y-select")
    customElements.define("y-select", YAJSFSelect)

    console.info("Register y-textarea")
    customElements.define("y-textarea", YAJSFTextArea)

    console.timeLog("YAJSF Init Time")
    console.groupEnd("YAJSF config")

    setReady()
}


export function configure(options={}) {
    Object.assign(settings, options)
}
