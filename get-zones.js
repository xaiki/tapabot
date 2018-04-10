const axios = require('axios')
const fs = require('fs')
const $ = require('cheerio')
const debug = require('debug')('tapa-bot-get-zones')

const {BASE_URL, FILES} = require('./config')

debug('writting to', FILES.ZONES, FILES.COUNTRIES, FILES.NEWSPAPERS)

let newspaperCache = {}
let countryCache = {}

let debugPromise = (name) => ((args) =>{
    debug('DEBUG:', name,  args)
    return args
})

let promiseWriteFile = (file, data) => (
    new Promise((accept, reject) => (
        fs.writeFile(file, JSON.stringify(data), (err) => (
            err ? reject(err) : accept(file)
        ))
    ))
)

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
                                         const name = $(e).attr('alt')
                                         newspapers[name] = {
                                             name: name,
                                             low: $(e).attr('src'),
                                             high: $(e).attr('src').replace('200', '750')
                                         }
                                     })

                                     newspaperCache = Object.assign(newspaperCache, newspapers)
                                     return newspapers
                                 })
                                 .then(newspapers => (Object.assign(countries, {
                                     [`${countryName}`]: {
                                         url: countryURL,
                                         name: countryName,
                                         newspapers: newspapers
                                     }
                                 })))
                 })


                 return Promise.all(countryPromises.get())
                               .then(() => {
                                   countryCache = Object.assign(countryCache, countries)

                                   return Object.assign(zones, {
                                       [`${zoneName}`]: {
                                           url: zone,
                                           name: zoneName,
                                           countries: countries
                                       }
                                   })
                               })
             })

         debug(zonePromises.get())
         return Promise.all(zonePromises.get())
                       .then(debugPromise('zonePromises'))
                       .then(() => zones)
     })
     .then(debugPromise('end'))
     .then((data) => (Promise.all([
         promiseWriteFile(FILES.ZONES, data),
         promiseWriteFile(FILES.COUNTRIES, countryCache),
         promiseWriteFile(FILES.NEWSPAPERS, newspaperCache)
     ])))
     .then(() => {
         debug('NEWSPAPERS', JSON.stringify(newspaperCache, null, 4))
     })
     .catch(err => debug('GOT ERROR', err))

