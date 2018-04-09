const axios = require('axios')
const fs = require('fs')
const $ = require('cheerio')
const debug = require('debug')('tapa-bot-get-zones')

const {BASE_URL, ZONES_FILE} = require('./config')

debug('writting to', ZONES_FILE)

let debugPromise = (name) => ((args) =>{
    debug('DEBUG:', name,  args)
    return args
})

axios.get(BASE_URL)
     .then((res) => {
         let zones = {}
         let zonePromises = $('#cabecera .barraMenu', res.data)
             .find('#menu > li').map((i, e) => {
                 let selector = $('a', e)

                 if (! selector || ! selector[0]) {
                     return;
                 }

                 const zone = selector.attr('href')
                 const zoneName = selector[0].children[0].data

                 if (zoneName === 'Inicio') {
                     return
                 }

                 let countries = {}
                 let countryPromises = $(e).find('ul li a').map((i, e) => {
                     const countryName = e.children[0].data
                     const countryURL = $(e).attr('href')

                     const generalURL = countryURL.match('.html') ? '' : 'general.html'

                     debug('getting', zoneName, countryName)
                     return axios.get(`${BASE_URL}${countryURL}${generalURL}`)
                                 .then((res) => {
                                     const newspapers = {}

                                     $(res.data).find('.thcover img').map((i, e) => {
                                         newspapers[$(e).attr('alt')] = {
                                             low: $(e).attr('src'),
                                             high: $(e).attr('src').replace('200', '750')
                                         }
                                     })

                                     return newspapers
                                 })
                                 .then(newspapers => {
                                     debug('got', zoneName, countryName)
                                     return newspapers
                                 })
                                 .then(newspapers => (Object.assign(countries, {
                                     [`${countryName}`]: {
                                         url: countryURL,
                                         newspapers: newspapers
                                     }
                                 })))
                 })

                 return Promise.all(countryPromises.get())
                               .then(() => (Object.assign(zones, {
                                   [`${zoneName}`]: {
                                       url: zone,
                                       countries: countries
                                   }
                               })))
             })

         debug(zonePromises.get())
         return Promise.all(zonePromises.get())
                       .then(debugPromise('zonePromises'))
                       .then(() => zones)
     })
     .then(debugPromise('end'))
     .then(JSON.stringify)
     .then((data) => (new Promise((accept, reject) => (
         fs.writeFile(ZONES_FILE, data, (err) => (
             err ? reject(err) : accept(ZONES_FILE)
         ))
     ))))
     .catch(err => debug('GOT ERROR', err))
