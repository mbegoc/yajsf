import type {
    Schema,
    PropertyType,
    Reference,
    Property,
    SchemaNode,
    Enum,
} from "../types"


export class SchemaError extends Error { }


export class SchemaHelper {
    protected schema: Schema
    constructor(schema: Schema) {
        this.schema = schema
    }

    * properties(): Iterable<[string, Property, boolean]> {
        for (let name in this.schema.properties) {
            yield [
                name,
                this.getProperty(name),
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
        return this._getNode(split, node)
    }

    protected _getNode(path: string[], node: SchemaNode): SchemaNode {
        let key = path.shift()
        if (key) {
            return this._getNode(path, node[key])
        } else {
            return node
        }
    }

    getProperty(name: string): Property {
        let {$ref, anyOf, ...fieldSchema}: any = this.schema.properties[name]

        if ($ref) {
            fieldSchema = this.getNode($ref)
        }

        if (anyOf) {
            fieldSchema = {...fieldSchema, ...this.reduceAnyOf(anyOf)}
        }

        return fieldSchema
    }

    reduceAnyOf(anyOf: PropertyType[]): PropertyType {
        // @KLUDGE: not sure of this behavior, how to determine the right type
        // and validation to apply on the field?
        return anyOf.reduce((r, i) => i["format"] && i["type"] ? i : r)
    }

    getSubSchema(node: SchemaNode): Schema | undefined {
        // @TODO: check if it could exist other cases
        let $ref = node.$ref || (node.items as Reference).$ref
        if ($ref) {
            let refNode = this.getNode($ref)
            if (refNode.properties) {
                return refNode as Schema
            }
        }

        return undefined
    }

    getEnum(node: SchemaNode): Enum {
        if (node.enum) {
            return node.enum
        } else if (node.items) {
            return this.getEnum(node.items)
        } else if (node.$ref) {
            return this.getEnum(this.getNode(node.$ref))
        }
        throw new SchemaError("Not an enum node")
    }

}
