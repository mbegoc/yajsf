// generic helpers
export type Literal = string | number | boolean

export type NullableLiteral = Literal | null

export type Dict<T=any> = {[key: string]: T}


// HTML related types
export type InputType = (
    "button" | "checkbox" | "color" | "date" | "datetime-local" | "email"
    | "file" | "hidden" | "image" | "month" | "week" | "number" | "password"
    | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text"
    | "time" | "url"
)

export type GlobalAttribute = (
    "accesskey" | "anchor Non-standard" | "autocapitalize" | "autofocus"
    | "class" | "contenteditable" | "data-${string}" | "dir" | "draggable"
    | "enterkeyhint" | "exportparts" | "hidden" | "id" | "inert" | "inputmode"
    | "is" | "itemid" | "itemprop" | "itemref" | "itemscope" | "itemtype"
    | "lang" | "nonce" | "part" | "popover" | "role" | "slot" | "spellcheck"
    | "style" | "tabindex" | "title" | "translate"
)

export type InputAttribute = GlobalAttribute | (
    "accept" | "alt" | "autocapitalize" | "autocomplete" | "capture"
    | "checked" | "dirname" | "disabled" | "form" | "formaction"
    | "formenctype" | "formmethod" | "formnovalidate" | "formtarget"
    | "height" | "list" | "max" | "maxlength" | "min" | "minlength"
    | "multiple" | "name" | "pattern" | "placeholder" | "popovertarget"
    | "popovertargetaction" | "readonly" | "required" | "size" | "src"
    | "step" | "type" | "value" | "width"
)

export type SelectAttribute = GlobalAttribute | (
    "autocomplete" | "autofocus" | "disabled" | "form" | "multiple" | "name"
    | "required" | "size"
)

export type TextAreaAttribute = GlobalAttribute | (
    "autocapitalize" | "autocomplete" | "autocorrect" | "autofocus" | "cols"
    | "dirname" | "disabled" | "form" | "maxlength" | "minlength" | "name"
    | "placeholder" | "readonly" | "required" | "rows" | "spellcheck" | "wrap"
)

// Partial make properties optional
// Record take the first type values as keys for the new type
// i.e. equivalent to [key: InputAttribute]: Literal
export type InputAttributes = Partial<Record<InputAttribute, Literal>> & {
    name?: string
    type?: InputType
}

export type SelectAttributes = Partial<Record<SelectAttribute, Literal>> & {
    name?: string
}

export type TextAreaAttributes = Partial<Record<TextAreaAttribute, Literal>> & {
    name?: string
}

export type HTMLFieldAttributes = InputAttributes & SelectAttributes & TextAreaAttributes

export type HTMLField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement


// YAJSF business types
export type FieldOption = {
    widget?: string
    title?: string
    attrs?: HTMLFieldAttributes
}


export type FieldOptions = Dict<FieldOption>


export type Reference = {
    $ref: `#/${string}`
}


export type Enum = Literal[]


export type PropertyType = {
    type?: string
    format?: string
    enum?: Enum
    items?: PropertyType | Reference
    default?: any
    writeOnly?: boolean
    minLength?: number
    maxLength?: number
    maximum?: number
    minimum?: number
    excluiveMinimum?: number
    excluiveMaximum?: number
}


export type Property = PropertyType & {
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
    properties: Dict<Property|Reference>
    $def?: Property | Schema
    required?: string[]
}


export type FormSettings = {
    schema: Schema
    data?: Dict<Literal>
    options?: FieldOptions
    errors?: Dict[]
}


export type SchemaNode = Schema | Property | PropertyType | Reference


export type MixedSchemaNode = Partial<Schema & Property & PropertyType & Reference>
