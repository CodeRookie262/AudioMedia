# ZeroMedia 原创封装的媒体库

**这是一款灵活的媒体库,可用它进行播放器的开发,音频可视化和录制**
**对媒体组件的操作更为简单,实时获取媒体组件的状态,内置事件触发器可更为灵活地监听并控制其行为**
> ### 如何使用?

```js
    let media = new ZeroMedia({
        el: audio | video,//(选填)
        source: '媒体资源',//支持类型 mp3, m4a, bufferArray, base64, blob...,
        // 事件绑定
        canplay(){},
        oncanplay(){}
        //...支持音频的原生事件绑定
    })
```


> ## API 

> ### 事件管理器

#### addEvent(type, cb[, deleteID])

`type` (String): 事件类型,如 `canplay`,`play`... (必填)
`cb` (Function): 回调函数, `callback`(必填)
`deleteID` (String): 事件标识符 (选填)

支持链式操作!!!

**用法**
```js
    media
    .addEvent('canplay',function(){
        console.log('可以播放了~')
    })
    .addEvent('play',function(){
        console.log('正在播放~')
    })
```

### once(type, cb)
`type` (String): 事件类型,如 `canplay`,`play`... (必填)
`cb` (Function): 回调函数, `callback`(必填)

顾名思义就是单次事件注册
支持链式操作!!!
**用法**
```js
    media
    .once('canplay',function(){
        console.log('可以播放了~')
    })
    .once('play',function(){
        console.log('正在播放~')
    })
```
### delEvent(type, deleteID)
事件注销

`type` (String): 事件类型,如 `canplay`,`play`... (必填)
`deleteID` (String | Function): 事件标识符 (必填)

支持链式操作!!!

```js
    media
    .delEvent('canplay',fnName1)
    .delEvent('play',fnName2)
```

> ### 媒体属性设置
### set(option)

`option` (Object): 设置的属性对象

支持链式操作!!!

**用法**
```js
    media.set({
        src: source,
        volume: .1
    })
```

### get(key)

`key` (String): 需要获取的属性


**用法**
```js
    media.get('duration')
```

> ### 音频可视化
### render(cb)
`render`(Function(data){}): 参数为一个回调函数,回调函数的第一个参数为音频数据,render 会动态执行此回调函数,起到动态视图渲染

**用法**
```js
    media
        .render(function render(array) {
            console.log(array)
        })
```

> ### 音频录制
### record(option)
`record`(Object): 参数为录制参数设置,如
```
    {
        sampleRate: 44100, // 采样率
        channelCount: 2, // 声道
        volume: 1.0 // 音量
    }
```
option参数为选填

支持链式操作!!!

### stopRecord() 暂停录制

### playRecord() 播放录制