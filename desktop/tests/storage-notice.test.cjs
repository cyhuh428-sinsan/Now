const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
test('native storage notices reach only other trusted app frames and never carry content or credentials',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),start=source.indexOf('function notifyStoreChanged('),end=source.indexOf('function registerDesktopStorageHandlers()',start);assert.ok(start>0&&end>start,'storage owner must notify peer workspaces');
 const sent=[],sender={},index=path.resolve('index.html'),wiki=path.resolve('wiki.html');
 const wc=url=>({isDestroyed:()=>false,getURL:()=>url,send:(route,payload)=>sent.push({route,payload})});
 const peers=[sender,wc(pathToFileURL(wiki).href+'?view=browse'),wc('https://foreign.invalid/'),wc(pathToFileURL(path.resolve('help.html')).href)];
 const box={APP_INDEX:index,APP_WIKI:wiki,pathToFileURL,BrowserWindow:{getAllWindows:()=>peers.map(webContents=>({webContents}))},assertRendererStoreKey:key=>assert.equal(key,'nownote.history.v1')};
 vm.createContext(box);vm.runInContext(source.slice(start,end),box);box.notifyStoreChanged(sender,'nownote.history.v1');
 assert.deepEqual(JSON.parse(JSON.stringify(sent)),[{route:'nownote:storage-changed',payload:{schema_version:1,key:'nownote.history.v1'}}]);
 sent.length=0;assert.throws(()=>box.storeMutation(sender,'nownote.history.v1',()=>{throw Error('not committed');}));assert.equal(sent.length,0);
 assert.throws(()=>box.storeMutation(sender,'nownote.history.v1',()=>{throw Object.assign(Error('ack interrupted'),{committed:true});}));assert.equal(sent.length,1);
});
test('preload exposes a disposable read-only change listener with an exact fixed-key payload',()=>{
 const listeners=new Map();let exposed;
 const box={process:{platform:'win32'},require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>{exposed=value;}},ipcRenderer:{on:(name,fn)=>listeners.set(name,fn),removeListener:(name)=>listeners.delete(name)}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../preload.cjs'),'utf8'),box);assert.equal(typeof exposed.storage.onChange,'function');
 const seen=[],stop=exposed.storage.onChange(key=>seen.push(key));
 listeners.get('nownote:storage-changed')({}, {schema_version:1,key:'nownote.history.v1'});
 listeners.get('nownote:storage-changed')({}, {schema_version:1,key:'foreign',content:'must not forward'});
 assert.deepEqual(seen,['nownote.history.v1']);stop();assert.equal(listeners.size,0);
});
