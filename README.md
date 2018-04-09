CaraDePapel: A Telegram Bot that shows you the world (via it's newspaper'scover)
===

in order to install this you need a telegram bot API key put in ../auth.js:
```js
module.exports = {
    API_KEY: '39823092804:THE-BOTMASTER_10v3sy0u50muc4p4p4'
}
```

then you should be able to just do:
```sh
yarn && yarn build && yarn start
```

we fetch newscovers from kiosko.net, we cache them into `zones.json`,
actually we watch that file, so if you just run `yarn build` it will update
that collection with the latest info.

to talk to this bot just add it and `/start` that's about it.
the commands are pretty straight forward: 
 - `/start` and `zones` will show you a list of world-zones (regions) you
   can see newspapers from
 - `/country ${countryName}` will list all newspapers in that country
 - `/get ${zone}/${countryName}` will send you all newspapers from a country
   neatly packed as 10 units albums
  - `/get ${zone}/${countryName}/${newspaper` will send you the cover of the day
