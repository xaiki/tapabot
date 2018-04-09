const {StringMap} = require('fast-n-fuzzy')

const debug = require('debug')('tapa-bot:search')

class fuzzySearch {
    constructor(
        items,
        resolve = (e) => (e),
        opts = {
            maxSearchResults: 3, // used for debug only
            maxDistance: 0.001   // this is set by trial and error
        }
    ) {
        this.opts = opts
        this.resolve = resolve
        this.stringMap = this.load(items, opts)
    }

    load(items) {
        debug('new stringMap', this.opts)
        let stringMap = new StringMap(this.opts)
        this.items = items
        Object.keys(items).map(k => stringMap.add(k, k))
        return stringMap
    }

    search(term, data) {
        let res = this.stringMap.search(term)
        if (!res) {
            return Promise.reject(new Error('not found'))
        }

        debug('search', res)
        if (res[0].distance > this.opts.maxDistance) {
            return Promise.reject(new Error('found with bad distance'))
        }

        return Promise.resolve(this.items[res[0].value])
                      .then(this.resolve.bind(this, data))
    }
}

module.exports = fuzzySearch



