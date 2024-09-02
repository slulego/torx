#!/usr/bin/env node

"use strict";

import { promises as fs } from "fs";
import * as path from "path";
import { performance } from "perf_hooks";

import * as torx from ".";
import { Configuration } from "./types";

const commandLine = require.main === module;

const configuration: Configuration = {
   sourceFile: undefined,
   sourceFolder: undefined,
   distributionFolder: undefined,
   watch: false,
   // dryRun: false,
};

const options = [
   {
      command: ["-v", "--version"],
      description: "Print torx version.",
      action: () => {
         printVersion();
         process.exit(0);
      },
   },
   {
      command: ["-h", "--help"],
      description: "List all command line options.",
      action: () => {
         printHelp();
         process.exit(0);
      },
   },
   {
      command: ["-w", "--watch"],
      description: "Watch for changes.",
      action: () => (configuration.watch = true),
   },
   // {
   //    command: ["-d", "--dry-run"],
   //    description: "Print which files will be compiled.",
   //    action: () => (configuration.dryRun = true),
   // },
];

if (commandLine) {
   const args = process.argv.slice(2);

   for (const arg of args) {
      const option = options.find(option => option.command.includes(arg));

      if (option) {
         option.action();
      } else {
         if (arg.startsWith("-")) {
            // An unknown command option
            exitError(`Unknown option '${arg}'`);
         } else if (!configuration.sourceFolder) {
            if (arg.endsWith(".torx")) {
               configuration.sourceFile = path.basename(arg);
               configuration.sourceFolder = path.dirname(arg);
            } else {
               configuration.sourceFolder = arg;
            }
         } else if (!configuration.distributionFolder) {
            configuration.distributionFolder = arg;
         } else {
            exitError(`Unknown option '${arg}'`);
         }
      }
   }

   console.log({ configuration });

   if (!configuration.sourceFolder) {
      exitError("The source file or folder must be provided.");
   }

   compile(configuration);
}

async function compile(configuration: Configuration) {
   if (configuration.watch) {
      // Watch for changes
      const watcher = fs.watch(configuration.sourceFolder);

      for await (const event of watcher) {
         if (event.eventType == "change" && path.extname(event.filename) === ".torx") {
            const startTime = performance.now();

            const fullPath = path.join(configuration.sourceFolder, event.filename);
            const distributionFolder = configuration.distributionFolder || configuration.sourceFolder;
            const outputFilename = path.join(distributionFolder, path.basename(fullPath, ".torx"));

            try {
               const compiled = await compileFile(fullPath, outputFilename);

               const endTime = performance.now();
               const buildTime = (endTime - startTime).toFixed();
               console.log(`BUILD: ${compiled} ${buildTime} ms`);
            } catch (error) {
               console.error(`ERROR: ${error}`);
            }
         }
      }
   } else {
      if (configuration.sourceFile) {
         const startTime = performance.now();

         // Single file
         await compileFile(configuration.sourceFile, configuration.distributionFolder);

         const endTime = performance.now();
         const buildTime = (endTime - startTime).toFixed();

         console.log(`BUILD: ${buildTime} ms`);
      } else {
         // File folder
      }
   }

   // const torxFiles = await findTorxFiles(configuration.sourceFolder);

   // try {
   //    await Promise.all(torxFiles.map(file => compileFile(file, configuration.distributionFolder)));

   //    const endTime = performance.now();
   //    const buildTime = (endTime - startTime).toFixed();

   //    console.log(`BUILD: ${buildTime} ms`);
   // } catch (error) {
   //    exitError(error.message);
   // }
}

async function findTorxFiles(dir: string): Promise<string[]> {
   let torxFiles: string[] = [];

   const files = await fs.readdir(dir);

   await Promise.all(
      files.map(async file => {
         const fullPath = path.join(dir, file);
         const stat = await fs.stat(fullPath);

         if (stat.isDirectory()) {
            // Recursively search in subdirectories
            torxFiles = torxFiles.concat(await findTorxFiles(fullPath));
         } else if (path.extname(file) === ".torx") {
            // If the file has a .torx extension, add it to the list
            torxFiles.push(fullPath);
         }
      }),
   );

   return torxFiles;
}

/**
 * Compiles and creates the the output file
 * @param sourcePath - the Torx file path
 * @param outPath - the output file path
 */
async function compileFile(sourcePath: string, outPath: string): Promise<string> {
   try {
      const text = await fs.readFile(sourcePath, "utf8");
      const compiledOutput = await torx.compile(text, {}, sourcePath);

      await fs.writeFile(outPath, compiledOutput);

      return outPath;
   } catch (error) {
      throw `${error}: (${sourcePath})`;
   }
}

/**
 * Print the package version number
 */
function printVersion() {
   const packageJson = require("../package.json");

   console.log(`${packageJson.name}@${packageJson.version}`);
}

/**
 * Print the list ofcommand line options
 */
function printHelp() {
   console.log("\nUsage: torx [source-folder] [distribution-folder] [options]");

   console.log("\nOptions: ");

   const commands = options.map(option => option.command.join(", "));
   const longestCommand = commands.reduce((longest, command) => Math.max(longest, command.length), 0);

   options.forEach(option => {
      const command = option.command.join(", ");
      const padding = " ".repeat(longestCommand - command.length);

      console.log(`  ${command}${padding}  ${option.description}`);
   });

   console.log();
}

/**
 * Exit with an error message
 * @param message - the error message
 */
function exitError(message: string) {
   console.error(`ERROR: ${message}`);
   process.exit(1);
}
