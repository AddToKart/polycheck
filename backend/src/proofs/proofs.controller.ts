import { Body, Controller, Delete, Get, Param, Post, Request } from '@nestjs/common'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ProofsService } from './proofs.service'
class UploadProofDto { @IsString() sectionId:string; @IsString() sessionId:string; @IsString() @MaxLength(8_000_000) photoData:string; @IsOptional() @IsString() @MaxLength(500) description?:string }
@Controller('proofs') export class ProofsController {constructor(private readonly proofs:ProofsService){}
 @Get(':sessionId') list(@Request() req,@Param('sessionId') sessionId:string){return this.proofs.list(req.user,sessionId)}
 @Post() upload(@Request() req,@Body() dto:UploadProofDto){return this.proofs.upload(req.user,dto)}
 @Delete(':id') remove(@Request() req,@Param('id') id:string){return this.proofs.remove(req.user,id)} }
