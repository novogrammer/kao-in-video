export const WEBCAM_WIDTH=256;
export const WEBCAM_HEIGHT=256;

export const RECORD_MAX_FACES = 4;

export const IS_REFINE_LANDMARKS = false;

export const IS_PRODUCTION = process.env.NODE_ENV == 'production';

interface VideoParams{
  url:string,
}

export const VIDEO_PARAMS_LIST=[
  // {
  //   url:`${window.relRoot}assets/movie/kari.mp4`,
  // },
  // {
  //   url:`${window.relRoot}assets/movie/kari2.mp4`,
  // },

  {
    url:`${window.relRoot}assets/movie/makudo_migihidari.mp4`,
  },
  {
    url:`${window.relRoot}assets/movie/makudo_nikoniko.mp4`,
  },
  {
    url:`${window.relRoot}assets/movie/makudo_sumaho.mp4`,
  },
  {
    url:`${window.relRoot}assets/movie/makudo_note.mp4`,
  },



];
