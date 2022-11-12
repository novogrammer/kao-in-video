import * as THREE from "three";
import { FACE_INDEX_LIST, NUM_KEYPOINTS } from './face_constants';
import { WEBCAM_HEIGHT, WEBCAM_WIDTH } from './constants';
import * as faceMesh from "@mediapipe/face_mesh";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";


interface FaceObject3DOptions{
  sourceVideo: HTMLVideoElement,
}

export class FaceObject3D extends THREE.Group{
  
  constructor(options:FaceObject3DOptions){
    super();
    this.userData.options=options;
    {
      const sourceVideoTexture = new THREE.VideoTexture(options.sourceVideo);
      sourceVideoTexture.encoding=THREE.sRGBEncoding;
      this.userData.sourceVideoTexture=sourceVideoTexture;
  
    }
    {
      const faceMesh=this.createFaceMesh();
      this.add(faceMesh);
      this.userData.faceMesh=faceMesh;
    }

  }
  createFaceMesh(){
    const geometry=new THREE.BufferGeometry();
    const faceWithoutLipIndexList=[];
    for(let i=0;i<FACE_INDEX_LIST.length;i+=3){
      const triangle=[FACE_INDEX_LIST[i+0],FACE_INDEX_LIST[i+1],FACE_INDEX_LIST[i+2]];
      const isLipTriangle=triangle.every((triangleIndex)=>faceMesh.FACEMESH_LIPS.some((landmarkConnection:[number, number])=>landmarkConnection.some((index)=>index==triangleIndex)));
      if(!isLipTriangle){
        faceWithoutLipIndexList.push(...triangle);
      }
    }
    geometry.setIndex(faceWithoutLipIndexList);
    const positionList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      positionList.push(0,0,0);
    }
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positionList,3));

    const uvList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      uvList.push(0,0);
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));

    const colorList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      if(faceMesh.FACEMESH_FACE_OVAL.some((landmarkConnection:[number, number])=>landmarkConnection.some((index)=>index==i))){
        colorList.push(1,1,1,0);
      }else{
        colorList.push(1,1,1,1);
      }
    }
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colorList,4));


    const material=new THREE.MeshBasicMaterial({
      // side:THREE.DoubleSide,
      // color:0xff00ff,
      transparent:true,
      vertexColors:true,
    });
    const mesh=new THREE.Mesh(geometry,material);
    mesh.frustumCulled = false;

    return mesh;
  }
  updateFaceGeometry(face:faceLandmarksDetection.Face,height:number){
    const {faceMesh}=this.userData;
    const {geometry} = faceMesh;
    const positionList=[];
    for(let keypoint of face.keypoints){
      positionList.push(keypoint.x,height - keypoint.y,keypoint.z * -1);
    }
    // console.log(face.keypoints);

    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positionList,3));
    geometry.getAttribute("position").needsUpdate=true;
    geometry.computeVertexNormals();

  }
  updateFaceMaterial(sourceFace:faceLandmarksDetection.Face){
    const faceMesh=this.userData.faceMesh;
    const geometry=faceMesh.geometry;
    const material=faceMesh.material as THREE.MeshBasicMaterial;

    const {sourceVideoTexture}=this.userData;

    const uvList=[];
    for(let keypoint of sourceFace.keypoints){
      uvList.push(
        keypoint.x/WEBCAM_WIDTH,
        1 - (keypoint.y/WEBCAM_HEIGHT),
      );
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));
    geometry.getAttribute("uv").needsUpdate=true;

    material.map=sourceVideoTexture;
    material.needsUpdate=true;

  }

}