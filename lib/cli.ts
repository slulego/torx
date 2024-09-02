#!/usr/bin/env node

"use strict";

import * as fs from "fs";
import * as torx from ".";
import { performance } from "perf_hooks";
import path = require("path");

const commandLine = require.main === module;

const configuration = {
   sourceFile: undefined,
   sourceFolder: undefined,
   distributionFolder: undefined,
   watch: false,
   dryRun: false,
};

const options = [
   {
      command: ["-v", "--version"],
      description: "Print torx version",
      action: () => printVersion(),
   },
   {
      command: ["-h", "--help"],
      description: "Print command line options",
      action: () => printHelp(),
   },
   {
      command: ["-w", "--watch"],
      description: "Watch for changes",
      action: () => (configuration.watch = true),
   },
   {
      command: ["-d", "--dry-run"],
      description: "Dry run",
      action: () => (configuration.dryRun = true),
   },
];

if (commandLine) {
   const args = process.argv.slice(2);
   const error = undefined;

   for (const arg of args) {
      const option = options.find(option => option.command.includes(arg));

      if (option) {
         option.action();
      } else {
         if (arg.startsWith("-")) {
            error = `Unknown option '${arg}'`;
            break;
         } else if (!configuration.sourceFolder) {
            if (arg.endsWith(".torx")) {
               configuration.sourceFile = arg;
               configuration.sourceFolder = "";
            } else {
               configuration.sourceFolder = arg;
            }
         } else if (!configuration.distributionFolder) {
            configuration.distributionFolder = arg;
         }
      }
   }

   if (error) {
      console.log(error);
      process.exit(1);
   }

   if (!configuration.sourceFile) {
      console.log("ERROR: At least source file or argument is required.");
      process.exit(1);
   }

   const startTime = performance.now();

   createFile(configuration.sourceFile, configuration.distributionFolder)
      .then(outPath => {
         const endTime = performance.now();
         const buildTime = (endTime - startTime).toFixed();
         console.log(`BUILD: ${outPath} (${buildTime} ms)`);
      })
      .catch(error => console.log(error));
}

/**
 * Compiles and creates the the output file
 * @param sourcePath - the Torx file path
 * @param outPath - the output file path
 */
function createFile(sourcePath: string, outPath: string): Promise<string> {
   return new Promise<string>((resolve, reject) => {
      if (fs.existsSync(sourcePath)) {
         fs.readFile(sourcePath, "utf8", (error, text) => {
            if (!error) {
               torx
                  .compile(text, {}, sourcePath)
                  .then(out => {
                     fs.writeFile(outPath, out, error => {
                        if (!error) {
                           resolve(outPath);
                        } else {
                           reject(error);
                        }
                     });
                  })
                  .catch(error => reject(error));
            } else {
               reject(`Could not read file ${sourcePath}`);
            }
         });
      } else {
         reject(`No file exists at '${sourcePath}'`);
      }
   });
}

/** Print the package version number */
function printVersion() {
   const packageJson = require("../package.json");

   console.log(`${packageJson.name}@${packageJson.version}`);
}

function printHelp() {
   console.log("\nOptions: ");
   options.forEach(option => {
      console.log(`  ${option.command.join(", ")}  ${option.description}`);
   });
}

function watch(folder: string) {
   fs.watch(folder, (eventType, filename) => {
      if (filename && path.extname(filename) === ".torx") {
         const fullPath = path.join(folder, filename);
         if (eventType === "rename") {
            if (fs.existsSync(fullPath)) {
               console.log(`File ${fullPath} has been added`);
            } else {
               console.log(`File ${fullPath} has been removed`);
            }
         } else if (eventType === "change") {
            console.log(`File ${fullPath} has been changed`);
         }
      }
   });
}
