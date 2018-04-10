const auth = require('../auth');
const TelegramBot = require('node-telegram-bot-api');
const chokidar = require('chokidar');
const moment = require('moment');
const debug = require('debug')('tapa-bot')

const FuzzySearch = require('./search');

const {IMG_BASE_URL, IMG_DATE_REGEXP, FILES} = require('./config')

const watcher = chokidar.watch(Object.values(FILES), {
    persistent: true
});

// replace the value below with the Telegram token you receive from @BotFather
const token = auth.API_KEY;

let zones = require(FILES.ZONES)
let zonesFuzzy = new FuzzySearch(zones, {}, (msg, z) => (
    getCountries(msg, z.name)
))

let countries = require(FILES.COUNTRIES)
let countriesFuzzy = new FuzzySearch(countries, {}, (msg, c) => {
    const chatId = msg.chat.id

    let newspapers = filterToday(c.newspapers)

    return sendNewsPapers(chatId, c.name, newspapers)
})

let newspapers = require(FILES.NEWSPAPERS)
let newspapersFuzzy = new FuzzySearch(newspapers, {maxDistance: 0.0001}, (msg, n) => {
    const chatId = msg.chat.id

    let newspapers = get10Days(n)

    return sendNewsPapers(chatId, 'UNSUPPORTED', newspapers)
})

function reload(path) {
    debug(`reloading everything because ${path} changed`)

    zones = require(FILES.ZONES)
    zonesFuzzy.load(zones)

    countries = require(FILES.COUNTRIES)
    countriesFuzzy.load(countries)

    newspapers = require(FILES.NEWSPAPERS)
    newspapersFuzzy.load(newspapers)
}

watcher.on('change', reload)

function usage() {
    return `
/get Zone/Country[/newspaper]
/zones
/countries Zone
/newspapers Zone/Country
`
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

function makeRowsKeyboard(keys, transform, rows = 3) {
    let keyboard = []
    while (keys.length) {
        keyboard.push(keys.splice(0, rows).map((k) => ({
            text: k,
            callback_data: transform(k)
        })))
    }

    return keyboard
}

function inlineRowsKeyboard(keys, transform, rows) {
    return {
        "reply_markup": {
            "inline_keyboard": makeRowsKeyboard(keys, transform, rows)
        }
    }
}

function getZones(msg) {
    const chatId = msg.chat.id;
    let user = msg.from.first_name

    let keyboard = inlineRowsKeyboard(Object.keys(zones), (z) => (`countries ${z}`))

    bot.sendMessage(chatId, `Ok ${user}, choose a zone`, keyboard);
}

function getCountries(msg, match) {
    let zone = match[1]

    const chatId = msg.chat.id;
    let user = msg.from.first_name
    let res = zones[zone].countries

    let keyboard = inlineRowsKeyboard(Object.keys(res), (c) => (`get ${zone}/${c}`))

    bot.sendMessage(chatId, `Ok ${user}, choose a country`, keyboard);
}

function start(msg) {
    getZones(msg)
}

function sendNewsPapers(chatId, country, entries)  {
    let i = 0
    do {
        debug('entries', entries)
        bot.sendMediaGroup(chatId, entries.splice(i, i+10).map((e) => {
            let [k, v] = e

            return {
                type: 'photo',
                media: v.high,
                caption: `${country}: ${k}`
            }
        }))
        i +=10
    } while (i < entries.length);
}

function parseImgURL(url) {
    return url.match(new RegExp(`${IMG_BASE_URL}/${IMG_DATE_REGEXP}/(.*)`))
}

function imgURLisToday(url) {
    let [, y, m, d] = parseImgURL(url)

    let nm = moment(`${y}${m}${d}`)
    return nm.format('YYYY/MM/DD') === moment().format('YYYY/MM/DD')
}

function get10Days(cover) {
    let [, y, m, d, highUrl] = parseImgURL(cover.high)

    let ret = {}
    let nm = moment(`${y}${m}${d}`)

    for (let i = 0; i < 10; i += 1) {
        let dt = nm.format('YYYY/MM/DD')
        ret[`${cover.name} (${dt})`] = {high: `${IMG_BASE_URL}/${dt}/${highUrl}`}
        nm.subtract(1, 'days')
    }

    return Object.entries(ret)
}

function filterToday(newspapers) {
    let entries = Object.entries(newspapers)
    return entries.filter(e => imgURLisToday(e[1].high))
}

function getCovers(msg, match) {
    let [zone, country, newspaper] = match[1].split('/')
    let userName = msg.from.first_name

    const chatId = msg.chat.id;

    if (! zone) {
        bot.sendMessage(chatId, `hey ${userName}, i need a zone baby`)
        return bot.sendMessage(chatId, usage())
    }

    if (! country) {
        bot.sendMessage(chatId,  `hey ${userName}, i need a zone baby`)
        return bot.sendMessage(chatId, usage())
    }

    if (! zones[zone]) {
        bot.sendMessage(chatId, 'wrong zone, try again')
        return bot.sendMessage(chatId, usage())
    }

    let countries = zones[zone].countries

    if (! country || ! countries[country]) {
        bot.sendMessage(chatId, 'wrong country, try again')
        return bot.sendMessage(chatId, usage())
    }

    let newspapers = newspaper && countries[country].newspapers[newspaper]
                   ? get10Days(countries[country].newspapers[newspaper])
                   : filterToday(countries[country].newspapers)

    return sendNewsPapers(chatId, country, newspapers)
}

function search (msg, match) {
    const [, term] = match

    const chatId = msg.chat.id

    debug('search', term)
    newspapersFuzzy.search(term, msg)
                   .catch(e => countriesFuzzy
                           .search(term, msg)
                           .catch(e => zonesFuzzy
                                   .search(term, msg)
                                   .catch(e => {
                                       let msg = `couldn't find \`${term}\` in newspapers, countries or zones`
                                       debug(msg)
                                       bot.sendMessage(chatId, msg)
                                   })))
                   .then((r) => debug(r))
}

const handlers = {
    'zones': getZones,
    'countries': getCountries,
    'start': start,
    'get': getCovers,
    'search': search
}

bot.on('callback_query', (cbq) => {
    const [, action, args] = cbq.data.match(/(\w+) ?(.*)/)
    const msg = cbq.message;
    const opts = {
        chat_id: msg.chat.id,
        message_id: msg.message_id
    };

    handlers[action](msg, [null, args])
    bot.editMessageText(`${action} → ${args}`, opts);
})


bot.getMe().then(({first_name, username}) => {
    let meRegExps = [
        new RegExp(`${first_name} (\w+) ?(.*)`),
        new RegExp(`${username} (\w+) ?(.*)`)
    ]

    bot.on('message', (msg) => {
        const chatId = msg.chat.id;

        meRegExps.forEach(r => {
            if (msg.text.match(r)) {
                bot.sendMessage(chatId, 'yes please')
            }
        })

        debug('got', msg)
    })

    Object.keys(handlers).forEach(k => {
        debug('instaling handler for:', k)

        bot.onText(new RegExp(`\/${k} ?(.*)`), handlers[k])
        bot.onText(new RegExp(`\/@?${first_name} ${k} ?(.*)`), handlers[k])
        bot.onText(new RegExp(`\/@?${username} ${k} ?(.*)`), handlers[k])
    })
})

