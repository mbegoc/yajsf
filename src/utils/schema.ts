import { mergeObjects } from "./helpers"


export class SchemaError extends Error {
    name = "SchemaError"
}


export class SchemaHelper {
    constructor(schema) {
        this.schema = schema
    }

    * properties() {
        for (let name in this.schema.properties) {
            yield [
                name,
                this.getProperty(name),
                Boolean(this.schema.required[name]),
            ]
        }
    }

    getNode(name, node=null) {
        console.groupCollapsed(name)
        let split = name.split("/")
        if (split[0] === "#") {
            split.shift()
            if (node) {
                throw new SchemaError("The path start from the root but a node is provided")
            }
            node = this.schema
        } else if (! node) {
            throw new SchemaError("The path is relative but no node is provided")
        }
        return this._getNode(split, node, name)
    }

    protected _getNode(path, node, initial) {
        console.log(path, node)
        let name = path.shift()
        if (path.length !== 0) {
            return this._getNode(path, node[name])
        } else {
            console.groupEnd(initial)
            return node[name]
        }
    }

    getProperty(name) {
        let {$ref, anyOf, ...fieldSchema} = this.schema.properties[name]

        if ($ref) {
            fieldSchema = this.getNode($ref)
        }

        if (anyOf) {
            fieldSchema = mergeObjects(fieldSchema, this.reduceAnyOf(anyOf))
        }

        return fieldSchema
    }

    reduceAnyOf(anyOf) {
        // @KLUDGE: not sure for this behavior, how to determine the right type
        // and validation to apply on the field?
        return anyOf.reduce((r, i) => i["format"] && i["type"] ? i : r)
    }

    getEnum(node) {
        let {enum: enum_, items, $ref} = node
        if (enum_ || items) {
            return this.getEnum(enum_ || items)
        } else if ($ref) {
            return this.getEnum(this.getNode($ref))
        }
        return node
    }

}
