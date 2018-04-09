const {StringMap} = require('fast-n-fuzzy')

const debug = require('debug')('tapa-bot:search')

class fuzzySearch {
    constructor(
        items,
        opts,
        resolve = (e) => (e),
    ) {
        this.opts = Object.assign({}, {
            maxSearchResults: 3, // used for debug only
            maxDistance: 0.001   // this is set by trial and error
        }, opts)
        this.resolve = resolve
        this.stringMap = this.load(items, opts)
    }

    load(items) {
        debug('new stringMap', this.opts)
        let stringMap = new StringMap(this.opts)
        this.items = items
        Object.keys(items).map(k => stringMap.add(k.replace(/\s+/g, '_'), k.replace(/\s+/g, '_')))
        return stringMap
    }

    search(term, data) {
        term = term.replace(/\s+/g, '_')
        let res = this.stringMap.search(term)
        if (!res) {
            return Promise.reject(new Error('not found'))
        }

        if (res[0].distance > this.opts.maxDistance) {
            return Promise.reject(new Error('found with bad distance'))
        }

        let k = res[0].value.replace(/_/g, ' ')
        debug('search', term, res, this.items[k])
        return Promise.resolve(this.items[k])
                      .then(this.resolve.bind(this, data))
    }
}

module.exports = fuzzySearch



