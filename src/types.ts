import { YAJSFField } from "./components"


export type FieldOption = {
    widget?: string
    attrs?: {[key: string]: any}
    type?: string
}


export type FieldOptions = {
    [key: string]: FieldOption
}


export type Reference = {
    [key: string]: any
    $ref: `#/${string}`
}


export type Enum = string[]


export type PropertyType = {
    [key: string]: any
    type?: string
    format?: string
    enum?: Enum
    items?: PropertyType | Reference
    default?: any
    writeOnly?: Boolean
    minLength?: number
    maxLength?: number
    maximum?: number
    minimum?: number
    excluiveMinimum?: number
    excluiveMaximum?: number
}


export type Property = PropertyType & {
    [key: string]: any
    title: string
    additionalProperties?: PropertyType
    anyOf?: PropertyType[]
}


// @TODO: check if we could use the schemasafe type directly
export type Schema = {
    [key: string]: any
    title: string
    type: string
    description: string
    properties: {[key: string]: Property|Reference}
    $def?: Property | Schema
    required?: string[]
}

export type SchemaNode = Schema | Property | PropertyType | Reference

export type HTMLField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export type MixedField = YAJSFField | HTMLField
