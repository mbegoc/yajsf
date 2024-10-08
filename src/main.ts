import './style.css'
import FieldRenderer from './renderers'
import BaseYAJSFForm  from './form-components'

import schema from './schema.json'
import data from './data.json'


console.log(BaseYAJSFForm)
const form = new (customElements.get('yajsf-form'))(schema)
const renderer = new FieldRenderer(schema, form, data, {
  "options": {"widget": "input", "attrs": {"type": "color"}},
})
await renderer.render()

document.querySelector('#app').appendChild(form)



// document.querySelector('body').innerHTML += `
// <yajsf-form method="POST">
//     <yajsf-field type="text">Username</yajsf-field>
//     <yajsf-field type="password">
//       Password
//       <ul slot="errors">
//         <li>Wrong password</li>
//         <li>Password too short</li>
//       </ul>
//     </yajsf-field>
//     <yajsf-textarea cols=50 rows=10>Bio</yajsf-textarea>
//     <yajsf-select>
//       Number
//       <option slot="options" value="1">Un</option>
//       <option slot="options" value="2">Deux</option>
//       <option slot="options" value="3">Trois</option>
//       <option slot="options" value="4">Quatre</option>
//     </yajsf-select>
// </yajsf-form>
// `
