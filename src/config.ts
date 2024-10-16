import { settings } from './settings'
export { settings } from './settings'
import type { Dict } from "./types"
import {
    YAJSFForm,
    YAJSFField,
    YAJSFInput,
    YAJSFSelect,
    YAJSFTextArea,
} from "./components"
import { getLogger } from "./utils/logging"


const logger = getLogger("Config")


// create a copy without the false writable flag
// @TODO: can we do that more elegantly?
// export settings = Object.fromEntries(Object.entries(baseConfig))


let setReady: Function | null = null
export const ready = new Promise(resolve => setReady = resolve)


export function registerComponents() {
    logger.time("YAJSF Init Time")

    // register the components as custom elements
    logger.info("Register y-form")
    customElements.define("y-form", YAJSFForm)

    logger.info("Register y-system")
    customElements.define("y-system", YAJSFField)

    logger.info("Register y-input")
    customElements.define("y-input", YAJSFInput)

    logger.info("Register y-select")
    customElements.define("y-select", YAJSFSelect)

    logger.info("Register y-textarea")
    customElements.define("y-textarea", YAJSFTextArea)

    logger.timeLog("YAJSF Init Time")

    setReady!()
}


export function configure(options: Dict) {
    Object.assign(settings, options)
}
