import type { Schema, PropertyType, Property, SchemaNode, Enum } from "../types"
import { mergeObjects } from "./helpers"


export class SchemaError extends Error { }


export class SchemaHelper {
    protected schema: Schema
    constructor(schema: Schema) {
        this.schema = schema
    }

    * properties(): Iterable<[string, Property, Boolean]> {
        for (let name in this.schema.properties) {
            yield [
                name,
                this.getProperty(name) as Property,
                Boolean(this.schema.required?.includes(name)),
            ]
        }
    }

    getNode(name: string, node?: SchemaNode): SchemaNode{
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

    protected _getNode(path: string[], node: SchemaNode, initial: string): SchemaNode {
        let name = path.shift()
        if (name) {
            return this._getNode(path, node[name], initial)
        } else {
            return node
        }
    }

    getProperty(name: string): PropertyType {
        let {$ref, anyOf, ...fieldSchema}: any = this.schema.properties[name]

        if ($ref) {
            fieldSchema = this.getNode($ref)
        }

        if (anyOf) {
            fieldSchema = mergeObjects(fieldSchema, this.reduceAnyOf(anyOf))
        }

        return fieldSchema
    }

    reduceAnyOf(anyOf: PropertyType[]): PropertyType {
        // @KLUDGE: not sure for this behavior, how to determine the right type
        // and validation to apply on the field?
        return anyOf.reduce((r, i) => i["format"] && i["type"] ? i : r)
    }

    getEnum(node: SchemaNode): Enum | Schema {
        let {enum: enum_, items, $ref}: any = node
        if (enum_ || items) {
            return this.getEnum(enum_ || items)
        } else if ($ref) {
            return this.getEnum(this.getNode($ref))
        }
        return node as string[]
    }

}
