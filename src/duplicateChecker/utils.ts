import filetype from 'magic-bytes.js'
export const buf2b64Url = (buf:Buffer)=>{
    return `data:${filetype(buf)[0].mime?.replace('jpeg', 'jpg')};base64,${(buf.toString('base64'))}`;
}