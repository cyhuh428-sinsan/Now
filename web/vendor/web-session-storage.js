/* Existing tab-only credentials and shared logout markers, with no token transfer. */
(() => {
  'use strict';
  function create({session,persistent,now=()=>Date.now()}){
    const SESSION='nownote.web.session.v1',LOGOUT='nownote.web.logout.v1',ACTIVE='nownote.web.auth.active.v1';
    function load(){try{const raw=session().getItem(SESSION);return raw?JSON.parse(raw):null;}catch{return null;}}
    function logoutTimestamp(){try{return Number(persistent().getItem(LOGOUT)||0);}catch{return 0;}}
    function active(){try{return persistent().getItem(ACTIVE)==='1';}catch{return false;}}
    function markActive(){try{persistent().setItem(ACTIVE,'1');}catch{}}
    function invalidated(value){
      if(!active())return true;const timestamp=logoutTimestamp();if(!timestamp)return false;
      const saved=Number(value?.savedAt||0);return !saved||saved<=timestamp;
    }
    function save(value){markActive();session().setItem(SESSION,JSON.stringify({...value,savedAt:now()}));}
    function clear(){session().removeItem(SESSION);}
    function markLoggedOut(){try{persistent().removeItem(ACTIVE);persistent().setItem(LOGOUT,String(now()));}catch{}}
    return {load,logoutTimestamp,active,markActive,invalidated,save,clear,markLoggedOut};
  }
  globalThis.NowWebSessionStorage={create};
})();
