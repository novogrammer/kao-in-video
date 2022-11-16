
export function eventLog(eventName:string):void{
  const date = new Date();
  console.log(`eventName: "${eventName}" date: ${date.toString()}`);
}