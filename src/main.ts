// @ts-nocheck
import './style.css'

import schema from './schema.json'
import data from './data.json'
import errors from './errors.json'

import { ready, configure } from './form-components'

(async () => {
  console.log('main waiting...')
  await ready
  console.log('main ready')
// be careful with this if the container node is refreshed: the component
// will be rerendered without the data. It happens for exemple if the
// innerHTML of the node is modified
const form = new (customElements.get('yajsf-form'))(schema, data, {
  "options": {"widget": "input", "attrs": {"type": "color"}},
  "uuid": {"attrs": {"placeholder": "xxxx-xxxx-xxx"}},
}, errors)
document.querySelector('#app').appendChild(form)

let div = document.createElement('div')
div.innerHTML = `
<h1>YAJSF</h1>
<yajsf-form method="POST" action="http://localhost:6543/api/accounts/users/"
  data-schema='${JSON.stringify(Object.assign(schema))}'
  data-data='${JSON.stringify(data)}'
  data-errors='${JSON.stringify(errors)}'
  data-options='{"options": {"widget": "input", "attrs": {"type": "color"}}}'>
</yajsf-form>
`
document.querySelector('#app').appendChild(div)

div = document.createElement('div')
const url = new URL(window.location)
div.innerHTML = `
<h1>YAJSF</h1>
<yajsf-form>
  <yajsf-input name="email" type="email" value="${url.searchParams.get('email')}"></yajsf-input>
  <yajsf-input name="password" type="password" value="${url.searchParams.get('password')}"></yajsf-input>
  <input name="wtf" />
  <div slot="buttons">
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </div>
</yajsf-form>

`
document.querySelector('#app').appendChild(div)
})()
