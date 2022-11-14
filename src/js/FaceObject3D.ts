import * as THREE from "three";
import { FACE_INDEX_LIST, NUM_KEYPOINTS } from './face_constants';
import { VIDEO_HEIGHT, VIDEO_WIDTH, WEBCAM_HEIGHT, WEBCAM_WIDTH } from './constants';
import * as faceMesh from "@mediapipe/face_mesh";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { disposeMesh } from "./three_utils";


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
      const realFaceMesh=this.createRealFaceMesh();
      this.add(realFaceMesh);
      this.userData.realFaceMesh=realFaceMesh;
    }
    {
      const placeHolderFaceMesh=this.createPlaceholderFaceMesh();
      this.add(placeHolderFaceMesh);
      this.userData.placeHolderFaceMesh=placeHolderFaceMesh;
    }
    this.isReal=false;
  }
  destroy(){
    const {realFaceMesh,placeHolderFaceMesh,sourceVideoTexture}=this.userData;
    if(realFaceMesh){
      disposeMesh(realFaceMesh);
    }
    if(placeHolderFaceMesh){
      disposeMesh(placeHolderFaceMesh);
    }
    if(sourceVideoTexture){
      sourceVideoTexture.dispose();
    }
  }
  createFaceMesh(material:THREE.Material){
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

    const mesh=new THREE.Mesh(geometry,material);
    mesh.frustumCulled = false;

    return mesh;
  }
  createRealFaceMesh(){
    const material=new THREE.MeshBasicMaterial({
      // side:THREE.DoubleSide,
      // color:0xff00ff,
      transparent:true,
      vertexColors:true,
    });
    const mesh=this.createFaceMesh(material);
    const {geometry}=mesh;
    const colorList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      if(faceMesh.FACEMESH_FACE_OVAL.some((landmarkConnection:[number, number])=>landmarkConnection.some((index)=>index==i))){
        colorList.push(1,1,1,0);
      }else{
        colorList.push(1,1,1,1);
      }
    }
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colorList,4));
    return mesh;
  }
  createPlaceholderFaceMesh(){
    const material=new THREE.MeshStandardMaterial({
      // side:THREE.DoubleSide,
      metalness:0.5,
      roughness:0.2,
      color:0xb8deff,
    });
    const mesh=this.createFaceMesh(material);
    return mesh;
  }

  updateFaceGeometry(face:faceLandmarksDetection.Face,height:number){
    const {realFaceMesh,placeHolderFaceMesh}=this.userData;
    const faceMeshList=[realFaceMesh,placeHolderFaceMesh];
    for(let faceMesh of faceMeshList){
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

  }
  updateFaceMaterial(sourceFace:faceLandmarksDetection.Face){
    const {realFaceMesh,options}=this.userData;
    const geometry=realFaceMesh.geometry;
    const material=realFaceMesh.material as THREE.MeshBasicMaterial;

    const {sourceVideoTexture}=this.userData;

    const w=options.sourceVideo.videoWidth!=0?options.sourceVideo.videoWidth:VIDEO_WIDTH;
    const h=options.sourceVideo.videoHeight!=0?options.sourceVideo.videoHeight:VIDEO_HEIGHT;
    const uvList=[];
    for(let keypoint of sourceFace.keypoints){
      uvList.push(
        keypoint.x/w,
        1 - (keypoint.y/h),
      );
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));
    geometry.getAttribute("uv").needsUpdate=true;

    material.map=sourceVideoTexture;
    material.needsUpdate=true;

  }
  get isReal():boolean{
    return this.userData.isReal;
  }
  set isReal(isReal:boolean){
    this.userData.isReal=isReal;
    const {realFaceMesh,placeHolderFaceMesh}=this.userData;
    realFaceMesh.visible=isReal;
    placeHolderFaceMesh.visible=!isReal;
  }
  

}