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
// const form = new (customElements.get('yajsf-form'))(schema, data, {
//   "options": {"widget": "input", "attrs": {"type": "color"}},
//   "uuid": {"attrs": {"placeholder": "xxxx-xxxx-xxx"}},
// }, errors)
// document.querySelector('#app').appendChild(form)
//
// let div1 = document.createElement('div')
// div1.innerHTML = `
// <h1>YAJSF</h1>
// <yajsf-form method="POST" action="http://localhost:6543/api/accounts/users/"
//   data-schema='${JSON.stringify(Object.assign(schema))}'
//   data-data='${JSON.stringify(data)}'
//   data-errors='${JSON.stringify(errors)}'
//   data-options='{"options": {"widget": "input", "attrs": {"type": "color"}}}'>
// </yajsf-form>
// `
// document.querySelector('#app').appendChild(div1)

let div2 = document.createElement('div')
let div3 = document.createElement('div')
const url = new URL(window.location)
div2.innerHTML = `
<h1>YAJSF</h1>
<yajsf-form >
  <yajsf-input name="email" type="email" value="${url.searchParams.get('email')}" required>Email</yajsf-input>
  <yajsf-input name="password" type="password" value="${url.searchParams.get('password')}" required>Password</yajsf-input>
  <!-- input name="wtf" type="email" required /-->
  <div slot="buttons">
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </div>
</yajsf-form>
`
div3.appendChild(div2)
document.querySelector('#app').appendChild(div2)

// let div3 = document.createElement('div')
// const url = new URL(window.location)
// div3.innerHTML = `
// <form id="test">
//   <input type="text" name="username" required/><br>
//   <input type="email" name="email" required/><br>
//   <input type="submit" />
// </form>
// `
// document.querySelector('#app').appendChild(div3)
})()
