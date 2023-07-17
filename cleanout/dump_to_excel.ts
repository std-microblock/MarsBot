import { readFileSync, writeFileSync } from "fs";
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { Readable } from 'stream';

const filename = "./1354938560_participants.json";
const json = JSON.parse(readFileSync(filename).toString());


const worksheet = XLSX.utils.json_to_sheet(json.map(v => {
    for (const i in v) {
        if (v[i] instanceof Object) v[i] = JSON.stringify(v[i])
    }
    return v;
}));
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
XLSX.utils.sheet_add_aoa(worksheet, [Object.keys(json[0])], { origin: "A1" });
XLSX.writeFile(workbook, filename + ".xlsx");