/**
 * @parse el audio 标签
 * @parse source 音频资源 支持网络资源,本地资源和 buffer 等资源格式
 * @parse load 事件 音频加载完毕的事件函数
 * @parse canplay 准备函数 当音频可播放时调用此事件
 * @parse setAudioAttribute 函数 设置自定义属性 如 loop, controls等
 * @parse events 注册事件集合
 *  */

class Media {
    constructor({
        el,
        source,
        ...option
    } = {}) {
        if (!el) {
            console.log('正在创建音频对象')
            el = document.createElement('audio')
            document.body.appendChild(el)
        }
        try {
            if (el.tagName !== 'AUDIO') {
                return console.error(`参数 el 不是 <audio /> 标签`);
            }
        } catch (e) {
            return console.error('参数 el 必须为一个标签');
        }

        Object.assign(this, {
            $el: el,
            option,
            $event: {}
        })

        // 再次修改,将事件属性移动到 events 事件内部去
        Media.EventCollect.call(this, ...arguments)

        this.init({ source })
    }

    // 支持原生的音频事件
    static MEDIA_EVNET = [
        'abort',
        'emptied',
        'durationchange',
        'canplaythrough',
        'canplay',
        'error',
        'ended',
        'play',
        'pause',
        'playing',
        'progress',
        'ratechange',
        'seeked',
        'seeking',
        'stalled',
        'suspend',
        'timeupdate',
        'volumechange',
        'waiting'
    ]

    static EventCollect(fns) {
        let { $el, $event } = this
        let that = this;

        for (let fnName in fns) {
            let fn = fns[fnName];
            if (Media.MEDIA_EVNET.includes(fnName = fnName.replace(/^on/, ''))) {
                // 如果不是一个函数,则无动于衷
                if (typeof fn !== 'function') continue;
                if (!$event[fnName]) {
                    $event[fnName] = []
                    $el['on' + fnName] = function() {
                        $event[fnName] && $event[fnName].forEach(item => item['fun'].call(that))
                    }
                }

                $event[fnName].push({
                    eventType: fnName, //事件类型
                    fun: fn, //绑定函数
                    id: (Date.now() + parseInt(Math.random() * 100)).toString(16) //标识ID
                })
            }
        }
    }

    // 工具函数
    static isFun(parse) {
        return typeof parse === 'function';
    }

    //工具函数
    static isObject(parse) {
        return (typeof parse === 'object' && parse !== null);
    }

    // 初始化函数
    init({ source }) {
        let { $el } = this;
        source ? ($el.src = source) : console.warn('暂无音频资源可加载');
        //返回实例
        return this;
    }

    // 歌曲加载进度
    getLoadProgress(cb) {
        if (typeof cb !== 'function') {
            return console.warn('参数必须为一个回调函数')
        }
        let { $el } = this
        $el.addEventListener('canplay', function() {
            let timer = setInterval(() => {
                var timeRages = $el.buffered;
                // 获取以缓存的时间
                var timeBuffered = timeRages.end(timeRages.length - 1);
                // 获取缓存进度，值为0到1
                var bufferPercent = timeBuffered / $el.duration;

                let data = {
                    currentProgress: timeBuffered, //当前的进度
                    duration: $el.duration, //总进度
                    percentage: bufferPercent //进度百分比
                }
                cb.call(this, data)
                if (bufferPercent >= 1) {
                    clearInterval(timer)
                }
            }, 200);
        })

        //返回实例对象
        return this;
    }

    // 准备函数 当音频可播放时调用此事件
    addEvent(type, cb, deleteID) {
        if (!Media.isFun(cb)) return false;

        if (typeof type !== 'string') {
            return console.error("参数 type 必须用一个字符串来指定事件的类型 如: addEvent('click',function(){...})")
        } else if (!Media.MEDIA_EVNET.includes(type = type.replace(/^on/, ''))) {
            console.warn(`Media 事件库不存在对该 ${type} 类型的事件绑定,请查阅事件库支持的事件类型`)
            console.group('Media 事件库\n' + Media.MEDIA_EVNET.join(' | '))
            console.groupEnd()
            return false;
        }

        let { $el, $event } = this;
        let that = this;
        if (!$event[type]) {
            $event[type] = []
            $el['on' + type] = function() {
                $event[type] && $event[type].forEach(item => item['fun'].call(that))
            }
        }

        $event[type].push({
            eventType: type,
            fun: cb,
            id: deleteID || (Date.now() + parseInt(Math.random() * 100)).toString(16)
        })

        //返回实例
        return this;
    }

    // 一次性函数
    once(type, cb) {
        let delId = (Date.now() + parseInt(Math.random() * 100)).toString(16);
        let that = this;

        this.addEvent(type, function() {
            cb.call(that);
            that.delEvent(type, delId)
        }, delId)

        return this;
    }

    // 删除事件
    delEvent(type, deleteID) {
        let { $event } = this;

        if ($event[type]) {
            let index = $event[type].findIndex(item => item.id === deleteID)
            $event[type].splice(index, 1)
        }

        //返回实例
        return this;
    }

    // 设置基础的自定义属性 如 loop, controls等
    set(option) {
        let { $el } = this;

        if (!Media.isObject(Media.isFun(option) ? (option = option()) : option)) {
            return console.error('参数 option可以设置为一个对象,或者一个返回值对一个对象(null 除外)的函数')
        }

        for (let key in option) {
            $el[key] = option[key]
        }
        //返回实例
        return this;
    }

    // 渲染视图函数 参数为一个函数 函数内部的第一个参数为 bufferArray 数据流
    render(cb) {
        let { $el } = this;
        let that = this;
        let atx = new AudioContext(),
            analyser = atx.createAnalyser(),
            audioSource = atx.createMediaElementSource($el);
        let timer = null;
        audioSource.connect(analyser)
        audioSource.connect(atx.destination)
        let data = new Uint8Array(analyser.frequencyBinCount)

        $el.addEventListener('play', function() {
            timer = setInterval(function drawCanvas() {
                // 刷新数据
                analyser.getByteFrequencyData(data)
                cb.call(that, data)
                    // requestAnimationFrame(drawCanvas)
            }, 1000 / 60);
            // 让数据流动起来
            atx.resume()
        })

        $el.addEventListener('pause', function() {
            clearInterval(timer)
        })

    }
}