// @ts-nocheck
/**
 * This file is used for dev and manual testing. The release build is done
 * with build.ts.
 */
import './style.css'

import schema from './fixtures/schema.json'
import data from './fixtures/data.json'
import errors from './fixtures/errors.json'

import { registerComponents, configure } from './config'


registerComponents()


// change default options
configure({
    "injectScripts": false,
    "preventHTTPSubmit": false,
    "integrateSystemValidationMessage": false,
})


let mode = "component"


switch (mode) {
    case "program":
        // be careful with this if the container node is refreshed: the component
        // will be rerendered without the data. It happens for exemple if the
        // innerHTML of the node is modified
        const form = new (customElements.get('y-form'))(schema, data, {
          "options": {"widget": "input", "attrs": {"type": "color"}},
          "uuid": {"attrs": {"placeholder": "xxxx-xxxx-xxx"}},
        }, errors)
        document.querySelector('#app').appendChild(form)
        break

    case "component":
        let div1 = document.createElement('div')
        div1.innerHTML = `
        <h1>YAJSF</h1>
        <y-form id="tag-data" novalidate
          data-schema='${JSON.stringify(Object.assign(schema))}'
          data-data='${JSON.stringify(data)}'
          data-errors='${JSON.stringify(errors)}'
          data-options='{"options": {"widget": "input", "attrs": {"type": "color"}}, "csrf_token": {"widget": "hidden"}, "id": {"attrs": {"type": "hidden"}}}'>
        </y-form>`
        document.querySelector('#app').appendChild(div1)
        break

    case "explicit":
        let div2 = document.createElement('div')
        const url = new URL(window.location)
        div2.innerHTML = `
        <h1>YAJSF</h1>
        <y-form novalidate id="tag-inline">
          <y-input name="email" type="email" value="${url.searchParams.get('email')}" required>Email</y-input>
          <y-input name="password" type="password" value="${url.searchParams.get('password')}" required>Password</y-input>
          <input name="wtf" type="email" required />
          <div slot="buttons">
            <button type="submit">Submit</button>
            <button type="reset">Reset</button>
          </div>
        </y-form>
        `
        document.querySelector('#app').appendChild(div2)
        break
}
