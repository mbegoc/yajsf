import { Dict } from "../types"


export function deepMerge(...objects: Dict[]) {
    let merged = structuredClone(objects.shift()) || {}

    for (let object_ of objects) {
        for (let [attribute, value] of Object.entries(object_ || {})) {
            if (typeof(value) === "object" && merged[attribute]) {
                value = deepMerge(merged[attribute], value)
            }
            merged[attribute] = value
        }
    }

    return merged
}
