YAJSF - Yet Another JSON Schema Form
====================================

This project aim to provide a cross tiers toolkit to quickly and easily
build forms from [json-schemas](https://json-schema.org/).

It aims to be as light as possible yet being powerful, transversal,
independant from too much dependencies, easily pluggable in any environment.

The point is to rely as much as possible on recent technology improvment, so
no support will be provided for older environments.

It also aims to keep as close as possible to the HTML standards and
specifications. It means you should be able to use the form components of the
library the way you use standard HTML (attributes, events, etc).

No special focus is put on performance for now. I strongly believe performance
rely in the first place into simplicity, clarity and lean architectures.

Run the project
---------------

### With Docker Compose

`docker compose up`

High level architecture
-----------------------

### (Web) Components

### Renderers - Builders

### JSON-schemas

### Proximity with native behaviors

Roadmap
-------

- Evaluate which validation lib is the best fit
- Make a way of sharing error messages between the backend and frontend
- Generates specific techonology templates from a meta template so homogeneity
  accross tiers and technologies is guaranted
- Make it public friendly through configuration
- Allow to set attributes on others nodes than the main one
- Make it validate schema against schemas definition versions
- Typing
- Full set of tests
- Add support for more than system widgets
- Add support for i18n
- Create documentation
- publish the lib and promote it
- add a logger

Acknowlegments
--------------

This library is highly inspired by the under development project
[JSON Schema Form Element](https://github.com/json-schema-form-element/jsfe).

It didn't meet my backend needs and is not production ready. Some key features
didn't work in a light environment (no frontend framework), so I decided to
start this project to fill my needs.

Many libraries are availale, but unfortunatelly, many of them are outdated or
very tightly bound to frameworks.

Hope it can be usefull for others too.
