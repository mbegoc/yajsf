export function mergeObjects(...objects) {
    let merged = structuredClone(objects.shift()) || {}
    for (let object_ of objects) {
        for (let [attribute, value] of Object.entries(object_ || {})) {
            if (typeof(value) === "object" && merged[attribute]) {
                value = mergeObject(merged[attribute], value)
            }
            merged[attribute] = value
        }
    }

    return merged
}
