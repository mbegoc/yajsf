export * from './style.css'
export { ready, configure } from './config'
export {
    YAJSFForm,
    YAJSFInput,
    YAJSFSelect,
    YAJSFTextArea,
} from "./components"
export { FormBuilder } from "./builders"

import { registerComponents } from './config'


registerComponents()
