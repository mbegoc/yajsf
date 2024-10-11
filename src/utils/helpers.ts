export function mergeObjects(...objects) {
    let merged = structuredClone(objects.shift()) || {}
    for (let o of objects) {
        for (let [attribute, value] of Object.entries(o || {})) {
            if (typeof(value) === "object" && merged[attribute]) {
                value = mergeObject(merged[attribute], value)
            }
            merged[attribute] = value
        }
    }

    return merged
}
