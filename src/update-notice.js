// Release notice state is separate from project and appearance storage.
function initUpdateNotice(){
 const dialog=$('#update-notice'),seenKey='level-diagram-studio:notice:1.1.0';
 const show=()=>{closeMenus();if(!dialog.open)dialog.showModal()};
 $('#update-close').addEventListener('click',()=>dialog.close());
 $('#update-continue').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{try{localStorage.setItem(seenKey,'seen')}catch{}canvasFocus()});
 const button=document.createElement('button');button.type='button';button.id='update-news';button.textContent='更新公告';button.addEventListener('click',show);
 $('[data-action="help"]').after(button);
 // The in-app browser and offline HTML use the same notice; desktop keeps offline startup quiet.
 if(document.documentElement.dataset.storageKey)return;
 let seen=false;try{seen=localStorage.getItem(seenKey)==='seen'}catch{}
 if(!seen){show();try{localStorage.setItem(seenKey,'seen')}catch{}}
}
