import { Face } from "@tensorflow-models/face-landmarks-detection";
import * as faceMesh from "@mediapipe/face_mesh";
import { NUM_KEYPOINTS_WITH_IRISES } from "./face_constants";

export function drawFace(context2d:CanvasRenderingContext2D,face:Face){
  context2d.save();
  context2d.strokeStyle="#f00";
  context2d.strokeRect(face.box.xMin,face.box.yMin,face.box.width,face.box.height);
  context2d.strokeStyle="#f0f";
  context2d.beginPath();
  for(let [fromIndex,toIndex] of faceMesh.FACEMESH_TESSELATION){
    const from=face.keypoints[fromIndex];
    const to=face.keypoints[toIndex];
    context2d.moveTo(from.x,from.y);
    context2d.lineTo(to.x,to.y);
  }
  context2d.stroke();

  // メモリリーク対策のために、バージョンを下げた。
  // if(NUM_KEYPOINTS_WITH_IRISES<=face.keypoints.length){
  //   context2d.strokeStyle="#ff0";
  //   context2d.beginPath();
  //   for(let [fromIndex,toIndex] of faceMesh.FACEMESH_LEFT_IRIS){
  //     const from=face.keypoints[fromIndex];
  //     const to=face.keypoints[toIndex];
  //     context2d.moveTo(from.x,from.y);
  //     context2d.lineTo(to.x,to.y);
  //   }
  //   for(let [fromIndex,toIndex] of faceMesh.FACEMESH_RIGHT_IRIS){
  //     const from=face.keypoints[fromIndex];
  //     const to=face.keypoints[toIndex];
  //     context2d.moveTo(from.x,from.y);
  //     context2d.lineTo(to.x,to.y);
  //   }
  //   context2d.stroke();

  // }
  context2d.restore();
}