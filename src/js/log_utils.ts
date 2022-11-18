
export function eventLog(eventName:string):string{
  const date = new Date();
  const message=`eventName: "${eventName}" date: ${date.toString()}`;
  console.log(message);
  return message;
}