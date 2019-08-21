class ZeroMedia {
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
            if (!(el.tagName !== 'AUDIO' || el.tagName !== 'VIDEO')) {
                return console.error(`参数 el 不是 <audio /> | <video /> 媒体标签`);
            }
        } catch (e) {
            return console.error('参数 el 必须为一个标签');
        }

        Object.assign(this, {
            $el: el,
            $option: option,
            $event: {},
            $record: {
                buffer: null,
                leftBurrerList: [],
                rightBufferList: []
            }
        })

        // 再次修改,将事件属性移动到 events 事件内部去
        ZeroMedia.EventCollect.call(this, ...arguments)

        this.init({ source })
    }

    // 支持原生的音频事件
    static ZeroMedia_EVNET = [
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
            if (ZeroMedia.ZeroMedia_EVNET.includes(fnName = fnName.replace(/^on/, ''))) {
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

    // 音频数据降维
    static mergeArray(list) {
        let length = list.length * list[0].length;
        let data = new Float32Array(length),
            offset = 0;
        for (let i = 0; i < list.length; i++) {
            data.set(list[i], offset);
            offset += list[i].length;
        }
        return data;
    }

    //创建音频文件
    static createWavFile(audioData) {
        const WAV_HEAD_SIZE = 44;
        let buffer = new ArrayBuffer(audioData.length * 2 + WAV_HEAD_SIZE),
            // 需要用一个view来操控buffer
            view = new DataView(buffer);
        // 写入wav头部信息
        // RIFF chunk descriptor/identifier
        ZeroMedia.writeUTFBytes(view, 0, 'RIFF');
        // RIFF chunk length
        view.setUint32(4, 44 + audioData.length * 2, true);
        // RIFF type
        ZeroMedia.writeUTFBytes(view, 8, 'WAVE');
        // format chunk identifier
        // FMT sub-chunk
        ZeroMedia.writeUTFBytes(view, 12, 'fmt ');
        // format chunk length
        view.setUint32(16, 16, true);
        // sample format (raw)
        view.setUint16(20, 1, true);
        // stereo (2 channels)
        view.setUint16(22, 2, true);
        // sample rate
        view.setUint32(24, 44100, true);
        // byte rate (sample rate * block align)
        view.setUint32(28, 44100 * 2, true);
        // block align (channel count * bytes per sample)
        view.setUint16(32, 2 * 2, true);
        // bits per sample
        view.setUint16(34, 16, true);
        // data sub-chunk
        // data chunk identifier
        ZeroMedia.writeUTFBytes(view, 36, 'data');
        // data chunk length
        view.setUint32(40, audioData.length * 2, true);

        let length = audioData.length;
        let index = 44;
        let volume = 1;
        for (let i = 0; i < length; i++) {
            view.setInt16(index, audioData[i] * (0x7FFF * volume), true);
            index += 2;
        }
        return buffer;
    }

    // 文件解析
    static writeUTFBytes(view, offset, string) {
        var lng = string.length;
        for (var i = 0; i < lng; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // 合并音频
    static interleaveLeftAndRight(left, right) {
        let totalLength = left.length + right.length;
        let data = new Float32Array(totalLength);
        for (let i = 0; i < left.length; i++) {
            let k = i * 2;
            data[k] = left[i];
            data[k + 1] = right[i];
        }
        return data;
    }


    // 初始化函数
    init({ source }) {
        let { $el } = this;
        source ? ($el.src = source) : console.warn('暂无音频资源可加载');

        // 上下文绑定 防止 IIFE 
        this.record = this.record.bind(this)
        this.saveRecord = this.saveRecord.bind(this)
        this.stopRecord = this.stopRecord.bind(this)
        this.playRecord = this.playRecord.bind(this)

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
        if (!ZeroMedia.isFun(cb)) return false;

        if (typeof type !== 'string') {
            return console.error("参数 type 必须用一个字符串来指定事件的类型 如: addEvent('click',function(){...})")
        } else if (!ZeroMedia.ZeroMedia_EVNET.includes(type = type.replace(/^on/, ''))) {
            console.warn(`ZeroMedia 事件库不存在对该 ${type} 类型的事件绑定,请查阅事件库支持的事件类型`)
            console.group('ZeroMedia 事件库\n' + ZeroMedia.ZeroMedia_EVNET.join(' | '))
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

        if ($event[type] && typeof deleteID === 'string') {
            let index = $event[type].findIndex(item => item.id === deleteID)
            $event[type].splice(index, 1)
        } else if ($event[type] && typeof deleteID === 'function') {
            let index = $event[type].findIndex(item => item.fun === deleteID)
            $event[type].splice(index, 1)
        } else {
            console.warn('事件队列中不存在该标识符')
        }

        //返回实例
        return this;
    }

    // 设置基础的自定义属性 如 loop, controls等
    set(option) {
        let { $el } = this;

        if (!ZeroMedia.isObject(ZeroMedia.isFun(option) ? (option = option()) : option)) {
            return console.error('参数 option可以设置为一个对象,或者一个返回值对一个对象(null 除外)的函数')
        }

        for (let key in option) {
            $el[key] = option[key]
        }
        //返回实例
        return this;
    }

    get(key) {
        let { $el } = this;
        if (typeof key !== 'string') return undefined;
        return $el[key];
    }

    // 渲染视图函数 参数为一个函数 函数内部的第一个参数为 bufferArray 数据流
    render(cb) {
        let { $el } = this;
        if ($el.tagName !== 'AUDIO') {
            return console.warn('音频可视化暂仅支持 <audio /> 标签')
        }
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
        return this;
    }

    record(options = {
        sampleRate: 44100, // 采样率
        channelCount: 2, // 声道
        volume: 1.0 // 音量
    }) {
        window.navigator.mediaDevices.getUserMedia({
            audio: options
        }).then(mediaStream => {
            console.log(mediaStream);
            this.saveRecord.call(this, mediaStream)
        })
    }

    saveRecord(mediaStream) {
        let audioContext = new(window.AudioContext || window.webkitAudioContext);
        let mediaNode = audioContext.createMediaStreamSource(mediaStream);
        // 创建一个jsNode
        let jsNode = ZeroMedia.createJSNode(audioContext);
        // 需要连到扬声器消费掉outputBuffer，process回调才能触发

        jsNode.connect(audioContext.destination);
        jsNode.onaudioprocess = this.onAudioProcess.bind(this);
        // 把mediaNode连接到jsNode
        mediaNode.connect(jsNode);

        Object.assign(this.$record, { mediaStream, jsNode, mediaNode })
    }

    static createJSNode(audioContext) {
        const BUFFER_SIZE = 4096;
        const INPUT_CHANNEL_COUNT = 2;
        const OUTPUT_CHANNEL_COUNT = 2;

        let creator = audioContext.createScriptProcessor || audioContext.createJavaScriptNode;
        creator = creator.bind(audioContext);
        return creator(BUFFER_SIZE,
            INPUT_CHANNEL_COUNT, OUTPUT_CHANNEL_COUNT);
    }


    onAudioProcess(event) {
        let audioBuffer = event.inputBuffer;
        let leftChannelData = audioBuffer.getChannelData(0),
            rightChannelData = audioBuffer.getChannelData(1);
        // 需要克隆一下
        this.$record.leftBurrerList.push(leftChannelData.slice(0));
        this.$record.rightBufferList.push(rightChannelData.slice(0));
    }

    // 暂停录制
    stopRecord() {
        console.log(this)
        let { mediaStream, mediaNode, jsNode, buffer, leftBurrerList, rightBufferList } = this.$record;
        // 停止录音
        mediaStream.getAudioTracks()[0].stop();
        mediaNode.disconnect();
        jsNode.disconnect();
        // console.log(leftDataList, rightDataList);
        let leftData = ZeroMedia.mergeArray(leftBurrerList),
            rightData = ZeroMedia.mergeArray(rightBufferList);
        let allData = ZeroMedia.interleaveLeftAndRight(leftData, rightData);
        console.log(ZeroMedia.createWavFile(allData))
        this.$record.buffer = ZeroMedia.createWavFile(allData)

    }

    //播放录音
    playRecord() {
        let { buffer } = this.$record
        if (!buffer) {
            return console.warn('主人,暂无录音可播放~');
        }

        let blob = new Blob([new Uint8Array(buffer)]);
        let url = URL.createObjectURL(blob);
        // 播放前将所有音频清除完毕
        let videos = document.getElementsByTagName('video'),
            audios = document.getElementsByTagName('audio');

        for (let i = 0; videos[i] || audios[i]; i++) {
            videos[i] && videos[i].pause()
            audios[i] && audios[i].pause()
        }

        let audio = document.createElement('audio');
        audio.src = url;
        document.body.appendChild(audio)
        audio.oncanplay = function() {
            console.log('录制音频正在播放中...')
            this.play()
        }
        audio.onended = function() {
            console.log('音频播放结束')
            document.body.removeChild(this)
        }
    }
}
