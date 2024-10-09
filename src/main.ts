// @ts-nocheck
import './style.css'

import schema from './schema.json'
import data from './data.json'

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
// })
// document.querySelector('#app').appendChild(form)
//
// const div = document.createElement('div')
// div.innerHTML = `
// <h1>YAJSF</h1>
// <yajsf-form method="POST" action="http://localhost:6543/api/accounts/users/"
//   data-schema='${JSON.stringify(Object.assign(schema))}'
//   data-data='${JSON.stringify(data)}'
//   data-options='{"options": {"widget": "input", "attrs": {"type": "color"}}}'>
// </yajsf-form>
// `
// document.querySelector('#app').appendChild(div)
})()
